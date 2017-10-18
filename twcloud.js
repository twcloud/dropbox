"use strict";
/// <reference path="./dropbox.min.d.ts" />
var wrapper;
(function (wrapper) {
    var SESSION_KEY = 'twcloud-dropbox-session';
    var ORIGINAL_KEY = 'twcloud-dropbox-original';
    var SCRIPT_KEY = 'twcloud-dropbox-script';
    var PRELOAD_KEY = 'twcloud-dropbox-preload';
    var SCRIPT_CACHE = "201710181";
    function tryParseJSON(str) {
        try {
            return JSON.parse(str);
        }
        catch (e) {
            return;
        }
    }
    var TwitsLoader = /** @class */ (function () {
        function TwitsLoader(type, preload) {
            var _this = this;
            this.type = type;
            this.apiKeyFull = "gy3j4gsa191p31x";
            this.apiKeyApps = "tu8jc7jsdeg55ta";
            this.token = {};
            if (type !== "apps" && type !== "full")
                throw "type must be either apps or full";
            this.client = new Dropbox({
                clientId: this.getKey()
            });
            this.status = new StatusHandler("");
            // Authenticate against Dropbox
            this.status.setStatusMessage("Authenticating with Dropbox...");
            //the hash could be either a permalink, or the response from dropbox oauth
            if (preload.hash && preload.hash !== "#") {
                var data = (preload.hash[0] === "#" ? preload.hash.slice(1) : preload.hash)
                    .split('&').map(function (e) { return e.split('=').map(function (f) { return decodeURIComponent(f); }); });
                if (data.find(function (e) { return Array.isArray(e) && (e[0] === "access_token"); })) {
                    data.forEach(function (e) {
                        _this.token[e[0]] = e[1];
                    });
                    //this is a token and we don't want tiddlywiki to see it
                    preload.hash = "";
                }
            }
            if (!this.token.access_token) {
                if (preload.path)
                    sessionStorage.setItem(PRELOAD_KEY, JSON.stringify(preload));
                else
                    sessionStorage.setItem(PRELOAD_KEY, '');
                location.href = this.client.getAuthenticationUrl(location.origin + location.pathname + "?type=" + type);
                return;
            }
            if (!preload.path && !preload.user)
                preload = tryParseJSON(sessionStorage.getItem(PRELOAD_KEY)) || { type: type };
            this.client.setAccessToken(this.token.access_token);
            sessionStorage.setItem(PRELOAD_KEY, '');
            this.initApp(preload);
        }
        TwitsLoader.prototype.getKey = function () {
            return (this.type === "full" ? this.apiKeyFull : (this.type === "apps" ? this.apiKeyApps : ""));
        };
        // Main application
        TwitsLoader.prototype.initApp = function (preload) {
            var _this = this;
            this.status.clearStatusMessage();
            this.client.usersGetCurrentAccount(undefined).then(function (res) {
                _this.user = res;
                if (preload.user
                    && (_this.user.account_id !== preload.user
                        || _this.token.account_id !== preload.user
                        || _this.type !== preload.type)) {
                    //allow the user to specify a link that is tied to a dropbox account
                    //also all permalinks specify the dropbox account id
                    alert('You are logged into a different dropbox account than the one specified in this link');
                    delete preload.user;
                    delete preload.path;
                }
                var profile = document.getElementById("twits-profile");
                var pic = document.createElement('img');
                pic.src = _this.user.profile_photo_url;
                pic.classList.add("profile-pic");
                profile.appendChild(pic);
                var textdata = document.createElement('span');
                _this.user.account_type;
                textdata.innerText = _this.user.name.display_name
                    + (_this.user.team ? ("\n" + _this.user.team.name) : "");
                textdata.classList.add(_this.user.team ? "profile-name-team" : "profile-name");
                profile.appendChild(textdata);
                profile.classList.remove("startup");
                if (preload.path)
                    _this.openFile(preload.path, preload.hash, true);
                else
                    _this.readFolder("", document.getElementById("twits-files"));
            });
        };
        ;
        TwitsLoader.prototype.isFileMetadata = function (a) {
            return a[".tag"] === "file";
        };
        TwitsLoader.prototype.isFolderMetadata = function (a) {
            return a[".tag"] === "folder";
        };
        TwitsLoader.prototype.isHtmlFile = function (stat) {
            return ['.htm', '.html'].indexOf(stat.name.slice(stat.name.lastIndexOf('.'))) > -1;
        };
        TwitsLoader.prototype.getHumanSize = function (size) {
            var TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            var power = 0;
            while (size >= 1024) {
                size /= 1024;
                power++;
            }
            return size.toFixed(1) + TAGS[power];
        };
        TwitsLoader.prototype.streamFilesListFolder = function (path, handler) {
            function resHandler(res) {
                handler(res.entries, !!res.has_more);
                if (res.has_more)
                    return this.client.filesListFolderContinue({
                        cursor: res.cursor
                    }).then(resHandler);
            }
            this.client.filesListFolder({
                path: path
            }).then(resHandler);
        };
        TwitsLoader.prototype.readFolder = function (path, parentNode) {
            var _this = this;
            var pageurl = new URL(location.href);
            var loadingMessage = document.createElement("li");
            loadingMessage.innerText = "Loading...";
            loadingMessage.classList.add("loading-message");
            var listParent = document.createElement("ol");
            listParent.appendChild(loadingMessage);
            parentNode.appendChild(listParent);
            var filelist = [];
            this.streamFilesListFolder(path, function (stats, has_more) {
                filelist.push.apply(filelist, stats);
                loadingMessage.innerText = "Loading " + filelist.length + "...";
                if (has_more)
                    return;
                loadingMessage.remove();
                filelist.sort(function (a, b) {
                    //order by isFolder DESC, name ASC
                    return (+_this.isFolderMetadata(b) - +_this.isFolderMetadata(a))
                        || a.name.localeCompare(b.name);
                });
                for (var t = 0; t < filelist.length; t++) {
                    var stat = filelist[t];
                    var listItem = document.createElement("li"), classes = [];
                    if (_this.isFolderMetadata(stat)) {
                        classes.push("twits-folder");
                    }
                    else if (_this.isFileMetadata(stat)) {
                        classes.push("twits-file");
                        if (_this.isHtmlFile(stat)) {
                            classes.push("twits-file-html");
                        }
                    }
                    var link;
                    classes.push("twits-file-entry");
                    if (_this.isFolderMetadata(stat) || (_this.isFileMetadata(stat) && _this.isHtmlFile(stat))) {
                        link = document.createElement("a");
                        link.href = location.origin + location.pathname + location.search
                            + "&path=" + encodeURIComponent(stat.path_lower)
                            + "&user=" + encodeURIComponent(_this.user.account_id) + location.hash;
                        link.setAttribute("data-twits-path", stat.path_lower);
                        link.addEventListener("click", _this.onClickFolderEntry(), false);
                    }
                    else {
                        link = document.createElement("span");
                    }
                    link.className = classes.join(" ");
                    var img = document.createElement("img");
                    img.src = "dropbox-icons-broken.gif";
                    img.style.width = "16px";
                    img.style.height = "16px";
                    link.appendChild(img);
                    link.appendChild(document.createTextNode(stat.name));
                    var size;
                    if (_this.isFileMetadata(stat) && _this.getHumanSize(stat.size)) {
                        size = document.createElement("span");
                        size.appendChild(document.createTextNode(" (" + _this.getHumanSize(stat.size) + ")"));
                        //link.appendChild(size);
                    }
                    listItem.appendChild(link);
                    if (size)
                        listItem.appendChild(size);
                    listParent.appendChild(listItem);
                }
            });
        };
        ;
        TwitsLoader.prototype.onClickFolderEntry = function () {
            var self = this;
            return function (event) {
                if (event.altKey || event.ctrlKey || event.shiftKey)
                    return true;
                var path = this.getAttribute("data-twits-path"), classes = this.className.split(" ");
                if (classes.indexOf("twits-folder") !== -1 && classes.indexOf("twits-folder-open") === -1) {
                    classes.push("twits-folder-open");
                    self.readFolder(path, this.parentNode);
                }
                if (classes.indexOf("twits-file-html") !== -1) {
                    self.openFile(path);
                }
                this.className = classes.join(" ");
                event.preventDefault();
                return false;
            };
        };
        ;
        TwitsLoader.prototype.openFile = function (path, hash, isPreload) {
            var _this = this;
            if (isPreload === void 0) { isPreload = false; }
            // Read the TiddlyWiki file
            // We can't trust Dropbox to have detected that the file is UTF8, 
            // so we load it in binary and manually decode it
            this.status.setStatusMessage("Reading HTML file...");
            var data;
            var load = function (d) {
                console.log(d, data);
                //if triggered and payload we go
                if (data === true && d)
                    _this.loadTiddlywiki(d);
                else if (!d && !data)
                    data = true;
                else if (d)
                    data = d;
                else
                    _this.loadTiddlywiki(data);
            };
            // gtag('event', 'loadtw', isPreload ? 'preload' : 'selector', () => { load(); });
            // setTimeout(() => { load() }, 5000);
            load();
            this.client.filesDownload({
                path: path
            }).then(function (res) {
                //debugger;
                return new Promise(function (resolve) {
                    var data = res.fileBlob;
                    delete res.fileBlob;
                    console.log(data.type);
                    var reader = new FileReader();
                    reader.addEventListener("loadend", function () {
                        // We have to manually decode the file as UTF8, annoyingly
                        // [ I wonder if this is still necessary in v2 since it is a buffer 
                        // however I think this is converting from UTF8 to UTF16  -Arlen ]
                        var byteData = new Uint8Array(reader.result);
                        var unicode = _this.manualConvertUTF8ToUnicode(byteData);
                        resolve({ text: unicode, blob: data, metadata: res, path: path, hash: hash });
                    });
                    reader.readAsArrayBuffer(data);
                    //debugger;
                });
            }).then(function (data) {
                load(data);
            });
        };
        TwitsLoader.prototype.manualConvertUTF8ToUnicode = function (utf) {
            var uni = [], src = 0, b1, b2, b3, c;
            while (src < utf.length) {
                b1 = utf[src++];
                if (b1 < 0x80) {
                    uni.push(String.fromCharCode(b1));
                }
                else if (b1 < 0xE0) {
                    b2 = utf[src++];
                    c = String.fromCharCode(((b1 & 0x1F) << 6) | (b2 & 0x3F));
                    uni.push(c);
                }
                else {
                    b2 = utf[src++];
                    b3 = utf[src++];
                    c = String.fromCharCode(((b1 & 0xF) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F));
                    uni.push(c);
                }
            }
            return uni.join("");
        };
        TwitsLoader.prototype.requestScript = function (url, type) {
            return new Promise(function (resolve) {
                var oReq = new XMLHttpRequest();
                oReq.open("GET", url, true);
                oReq.responseType = type;
                oReq.onload = function (oEvent) {
                    //var blob = new Blob([oReq.response], {type: "image/png"});
                    resolve(oReq.response);
                };
                oReq.send();
            });
        };
        TwitsLoader.prototype.buildNewBlob = function (data) {
            var _this = this;
            // const { blob, metadata, path, text } = data;
            var startIndex = data.text.indexOf('<html');
            var htmlheader = (startIndex === -1) ? "<" + "!DOCTYPE html>" : data.text.slice(0, startIndex);
            var scriptparts = [
                '(function(){ \n',
            ];
            this.requestScript('dropbox.min.js', "text").then(function (res) {
                scriptparts.push("const Dropbox = (function(module){ var exports = module.exports; \n");
                scriptparts.push(res);
                scriptparts.push('\n; return module.exports; })({ exports: {} }); \n');
                return _this.requestScript('twcloud.js?' + SCRIPT_CACHE, "text");
            }).then(function (res) {
                scriptparts.push(res);
                scriptparts.push('\n })(); \n');
                return _this.requestScript('tiddly-saver-inject.js?' + SCRIPT_CACHE, "text");
            }).then(function (res) {
                scriptparts.push(res);
                // const scriptblob = new Blob(scriptparts, { type: 'application/javascript' });
                // const scripturl = URL.createObjectURL(scriptblob);
                // console.log(scripturl)
                var css = document.getElementById('twits-saver-styles').innerHTML;
                var htmlparts = [
                    htmlheader,
                    '<style>' + css + '</style>',
                    // '\n<' + 'script src="' + scripturl + '"></' + 'script>\n',
                    '\n<' + 'script>' + ("\n(function(){\n\tconst SCRIPT_KEY = '" + SCRIPT_KEY + "';\n\tconst scriptStr = sessionStorage.getItem(SCRIPT_KEY);\n\tsessionStorage.setItem(SCRIPT_KEY, '');\n\tconst scriptTag = document.createElement('script');\n\tscriptTag.src = URL.createObjectURL(new Blob([scriptStr], {type: \"application/javascript\"}));\n\tdocument.head.append(scriptTag);\n})();\n") + '</' + 'script>\n',
                    data.blob
                ];
                var blob = new Blob(htmlparts, { type: 'text/html' });
                var url = URL.createObjectURL(blob);
                // console.log(url);
                var session = {
                    token: _this.token,
                    type: _this.type,
                    path: data.path,
                    metadata: data.metadata,
                    profilepic: _this.user.profile_photo_url
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
                sessionStorage.setItem(ORIGINAL_KEY, data.text);
                sessionStorage.setItem(SCRIPT_KEY, scriptparts.join('\n'));
                location.href = url + (typeof data.hash === "string" ? data.hash : '');
            });
        };
        TwitsLoader.prototype.loadTiddlywiki = function (data) {
            var self = this;
            this.buildNewBlob(data);
            //allow-same-origin 
            // document.body.innerHTML = `<iframe id="twits-iframe" sandbox="allow-same-origin allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-scripts"></iframe>`;
            // this.iframe = document.getElementById('twits-iframe') as HTMLIFrameElement;
            return true;
        };
        return TwitsLoader;
    }());
    var StatusHandler = /** @class */ (function () {
        function StatusHandler(profilepic) {
            this.profilepic = profilepic;
            //initialize the status panel
            this.clearStatusMessage();
        }
        // private statusPanelCache: any;
        StatusHandler.prototype.getStatusPanel = function () {
            // if(this.statusPanelCache) return this.statusPanelCache;
            // debugger;
            var getElement = function (id, parentNode) {
                parentNode = parentNode || document;
                var el = document.getElementById(id);
                if (!el) {
                    el = document.createElement("div");
                    el.setAttribute("id", id);
                    parentNode.appendChild(el);
                }
                return el;
            }, status = getElement("twits-status", document.body), message = getElement("twits-message", status), progress = getElement("twits-progress", status);
            status.style.display = "block";
            if (this.profilepic && status.getElementsByClassName('profile-pic').length === 0) {
                var profile = document.createElement('img');
                profile.src = this.profilepic;
                profile.classList.add("profile-pic");
                status.insertBefore(profile, message);
            }
            return { status: status, message: message, progress: progress };
            // return this.statusPanelCache;
        };
        StatusHandler.prototype.clearStatusMessage = function () {
            var status = this.getStatusPanel();
            status.status.style.display = "none";
        };
        StatusHandler.prototype.setStatusMessage = function (text) {
            var status = this.getStatusPanel();
            while (status.message.hasChildNodes()) {
                status.message.removeChild(status.message.firstChild);
            }
            status.message.appendChild(document.createTextNode(text));
        };
        return StatusHandler;
    }());
    var SaverHandler = /** @class */ (function () {
        function SaverHandler(sessiondata) {
            this.token = sessiondata.token;
            this.type = sessiondata.type;
            this.currentRev = sessiondata.metadata.rev;
            this.status = new StatusHandler(sessiondata.profilepic);
            this.originalPath = sessiondata.path;
            // window.originalHTML = original;
            this.metadata = sessiondata.metadata;
            this.client = new Dropbox({
                clientId: this.getKey(),
                accessToken: this.token.access_token
            });
            this.setupSaving();
        }
        Object.defineProperty(SaverHandler.prototype, "apiKeyFull", {
            get: function () { return "gy3j4gsa191p31x"; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(SaverHandler.prototype, "apiKeyApps", {
            get: function () { return "tu8jc7jsdeg55ta"; },
            enumerable: true,
            configurable: true
        });
        SaverHandler.prototype.getKey = function () {
            return (this.type === "full" ? this.apiKeyFull : (this.type === "apps" ? this.apiKeyApps : ""));
        };
        SaverHandler.prototype.setupSaving = function () {
            var _this = this;
            console.log('inserting message box');
            var messageBox = document.getElementById("tiddlyfox-message-box");
            if (!messageBox) {
                messageBox = document.createElement("div");
                messageBox.id = "tiddlyfox-message-box";
                messageBox.style.display = "none";
                document.body.appendChild(messageBox);
            }
            // Attach the event handler to the message box
            messageBox.addEventListener("tiddlyfox-save-file", function (ev) {
                // Get the details from the message
                var messageElement = event.target, path = messageElement.getAttribute("data-tiddlyfox-path"), content = messageElement.getAttribute("data-tiddlyfox-content"), backupPath = messageElement.getAttribute("data-tiddlyfox-backup-path");
                // messageId = "tiddlywiki-save-file-response-" + this.idGenerator++;
                if (path !== document.location.toString())
                    return;
                _this.saveTiddlyWiki(content, function (err) {
                    // Send a confirmation message
                    var event = document.createEvent("Events");
                    event.initEvent("tiddlyfox-have-saved-file", true, false);
                    event.savedFilePath = path;
                    messageElement.dispatchEvent(event);
                });
                // Remove the message element from the message box
                messageElement.parentNode.removeChild(messageElement);
            }, false);
        };
        // onmessage(event) {
        // 	if (event.data.message === 'save-file-tiddly-saver') {
        // 		this.saveTiddlyWiki(event.data.data, (err) => {
        // 			event.source.postMessage({ message: 'file-saved-tiddly-saver', id: event.data.id, error: err }, this.targetOrigin);
        // 		})
        // 	}
        // 	else if (event.data.message === 'thankyou-tiddly-saver') {
        // 		this.messageSaverReady = true;
        // 		if (event.data.isTWC) event.source.postMessage({ message: 'original-html-tiddly-saver', originalText: this.originalText }, this.targetOrigin);
        // 	}
        // 	else if (event.data.message === 'update-tiddly-saver') {
        // 		if (event.data.TW5SaverAdded) {
        // 			alert("The saver for TW5 has now been added. Changes in TW5 will now be saved as usual.");
        // 		}
        // 	}
        // }
        SaverHandler.prototype.saveTiddlyWiki = function (text, callback) {
            var _this = this;
            this.status.setStatusMessage("Saving changes...");
            //TODO: add progress tracker
            this.client.filesUpload({
                path: this.originalPath,
                mode: {
                    ".tag": "update",
                    "update": this.currentRev
                },
                contents: text
            }).then(function (res) {
                _this.status.clearStatusMessage();
                _this.currentRev = res.rev;
                callback(null);
            }).catch(function (err) {
                console.log(err);
                callback(err.toString());
            });
        };
        return SaverHandler;
    }());
    // only load if we are on http or https, otherwise we are probably in a blob
    if (location.protocol.indexOf('http') === 0) {
        //save and clear the hash to prevent Google Analytics from seeing it
        var locationHash_1 = location.hash;
        location.hash = "";
        document.addEventListener("DOMContentLoaded", function (event) {
            var url = new URL(location.href);
            var accessType = url.searchParams.get('type');
            var preload = {
                type: decodeURIComponent(url.searchParams.get('type') || ''),
                path: decodeURIComponent(url.searchParams.get('path') || ''),
                user: decodeURIComponent(url.searchParams.get('user') || ''),
                hash: locationHash_1 || ''
            };
            if (!accessType)
                return;
            document.getElementById('twits-selector').style.display = "none";
            new TwitsLoader(accessType, preload);
        }, false);
    }
    else if (location.protocol === "blob:") {
        var sessionStr_1 = sessionStorage.getItem(SESSION_KEY);
        sessionStorage.setItem(SESSION_KEY, '');
        document.addEventListener("DOMContentLoaded", function (event) {
            if (!sessionStr_1)
                return alert('The session could not be loaded');
            var sessiondata = JSON.parse(sessionStr_1);
            new SaverHandler(sessiondata);
        }, false);
    }
})(wrapper || (wrapper = {}));
