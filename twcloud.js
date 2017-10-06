"use strict";
/// <reference path="./dropbox.min.d.ts" />
var wrapper;
(function (wrapper) {
    var SCRIPT_CACHE = "201710052";
    var twits = /** @class */ (function () {
        function twits(type, preload) {
            var _this = this;
            this.type = type;
            this.preload = preload;
            this.targetOrigin = "*";
            this.apiKeyFull = "gy3j4gsa191p31x";
            this.apiKeyApps = "tu8jc7jsdeg55ta";
            this.token = {};
            if (type !== "apps" && type !== "full")
                throw "type must be either apps or full";
            this.client = new Dropbox({
                clientId: this.getKey()
            });
            // Authenticate against Dropbox
            this.setStatusMessage("Authenticating with Dropbox...");
            if (document.location.hash) {
                var data = document.location.hash.slice(1);
                data.split('&').map(function (e) { return e.split('=').map(function (f) { return decodeURIComponent(f); }); }).forEach(function (e) {
                    _this.token[e[0]] = e[1];
                });
                //keep the hash on localhost for development purposes
                //it will be removed later when the wiki is loaded
                if (location.origin !== "http://localhost")
                    location.hash = "";
            }
            if (!this.token.access_token) {
                if (preload)
                    sessionStorage.setItem('twcloud-dropbox-path', preload);
                else
                    sessionStorage.setItem('twcloud-dropbox-path', '');
                location.href = this.client.getAuthenticationUrl(location.origin + location.pathname + "?type=" + type);
                return;
            }
            else {
                this.client.setAccessToken(this.token.access_token);
            }
            if (!preload)
                preload = sessionStorage.getItem('twcloud-dropbox-path');
            sessionStorage.setItem('twcloud-dropbox-path', '');
            this.initApp(preload);
        }
        twits.prototype.getKey = function () {
            return (this.type === "full" ? this.apiKeyFull : (this.type === "apps" ? this.apiKeyApps : ""));
        };
        // Main application
        twits.prototype.initApp = function (preload) {
            var _this = this;
            this.clearStatusMessage();
            this.client.usersGetCurrentAccount(undefined).then(function (res) {
                _this.user = res;
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
                if (preload)
                    _this.openFile(preload);
                else
                    _this.readFolder("", document.getElementById("twits-files"));
            });
        };
        ;
        twits.prototype.isFileMetadata = function (a) {
            return a[".tag"] === "file";
        };
        twits.prototype.isFolderMetadata = function (a) {
            return a[".tag"] === "folder";
        };
        twits.prototype.isHtmlFile = function (stat) {
            return ['.htm', '.html'].indexOf(stat.name.slice(stat.name.lastIndexOf('.'))) > -1;
        };
        twits.prototype.getHumanSize = function (size) {
            var TAGS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            var power = 0;
            while (size >= 1024) {
                size /= 1024;
                power++;
            }
            return size.toFixed(1) + TAGS[power];
        };
        twits.prototype.streamFilesListFolder = function (path, handler) {
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
        twits.prototype.readFolder = function (path, parentNode) {
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
                            + "&path=" + encodeURIComponent(stat.path_lower) + location.hash;
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
                    if (_this.isFileMetadata(stat) && _this.getHumanSize(stat.size)) {
                        var size = document.createElement("span");
                        size.appendChild(document.createTextNode(" (" + _this.getHumanSize(stat.size) + ")"));
                        link.appendChild(size);
                    }
                    listItem.appendChild(link);
                    listParent.appendChild(listItem);
                }
            });
        };
        ;
        twits.prototype.onClickFolderEntry = function () {
            var self = this;
            return function (event) {
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
        twits.prototype.openFile = function (path) {
            var _this = this;
            // Read the TiddlyWiki file
            // We can't trust Dropbox to have detected that the file is UTF8, 
            // so we load it in binary and manually decode it
            this.setStatusMessage("Reading HTML file...");
            this.client.filesDownload({
                path: path
            }).then(function (res) {
                //debugger;
                _this.currentRev = res.rev;
                return new Promise(function (resolve) {
                    var data = res.fileBlob;
                    console.log(data.type);
                    var reader = new FileReader();
                    reader.addEventListener("loadend", function () {
                        // We have to manually decode the file as UTF8, annoyingly
                        // [ I wonder if this is still necessary in v2 since it is a buffer 
                        // however I think this is converting from UTF8 to UTF16  -Arlen ]
                        var byteData = new Uint8Array(reader.result);
                        var unicode = _this.manualConvertUTF8ToUnicode(byteData);
                        _this.originalPath = path;
                        _this.originalText = unicode;
                        _this.originalBlob = res.fileBlob;
                        resolve({ data: unicode, blob: res.fileBlob });
                    });
                    reader.readAsArrayBuffer(data);
                    //debugger;
                });
            }).then(function (_a) {
                var data = _a.data, blob = _a.blob;
                _this.loadTiddlywiki(data, blob);
            });
        };
        twits.prototype.manualConvertUTF8ToUnicode = function (utf) {
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
        twits.prototype.getStatusPanel = function () {
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
            if (this.user) {
                var profile = document.createElement('img');
                profile.src = this.user.profile_photo_url;
                profile.classList.add("profile-pic");
                status.insertBefore(profile, message);
            }
            return { status: status, message: message, progress: progress };
        };
        ;
        twits.prototype.clearStatusMessage = function () {
            var status = this.getStatusPanel();
            status.status.style.display = "none";
        };
        twits.prototype.setStatusMessage = function (text) {
            var status = this.getStatusPanel();
            while (status.message.hasChildNodes()) {
                status.message.removeChild(status.message.firstChild);
            }
            status.message.appendChild(document.createTextNode(text));
        };
        ;
        twits.prototype.setProgress = function (text) {
            var status = this.getStatusPanel();
            while (status.progress.hasChildNodes()) {
                status.progress.removeChild(status.progress.firstChild);
            }
            status.progress.appendChild(document.createTextNode(text));
        };
        ;
        // Display an error
        twits.prototype.showError = function (error) {
            this.setStatusMessage("Error: " + error);
            this.setProgress("");
        };
        ;
        twits.prototype.requestScript = function (url) {
            return new Promise(function (resolve) {
                var oReq = new XMLHttpRequest();
                oReq.open("GET", url, true);
                oReq.responseType = "text";
                oReq.onload = function (oEvent) {
                    //var blob = new Blob([oReq.response], {type: "image/png"});
                    resolve(oReq.response);
                };
                oReq.send();
            });
        };
        twits.prototype.buildNewBlob = function (originalBlob, originalText) {
            var _this = this;
            var startIndex = originalText.indexOf('<html');
            var htmlheader = (startIndex === -1) ? "<" + "!DOCTYPE html>" : originalText.slice(0, startIndex);
            var modHeader = '(function(module){ var exports = module.exports;';
            var modFooter = '; return module.exports; })({ exports: {} });';
            var lines = [
                htmlheader,
                '<' + 'script>(function(){',
            ];
            this.requestScript('dropbox.min.js').then(function (res) {
                lines.push("const Dropbox = " + modHeader + res + modFooter);
                return _this.requestScript('twcloud.js?' + SCRIPT_CACHE);
            }).then(function (res) {
                lines.push(res);
                lines.push('})();');
                return _this.requestScript('tiddly-saver-inject.js?' + SCRIPT_CACHE);
            }).then(function (res) {
                lines.push(res);
                lines.push('<' + '/script>');
                // const trailer = '<' + 'script>if(typeof config !== "undefined" && config && config.options) config.options.chkHttpReadOnly = false;<' + '/script>';
                var blob = new Blob([lines.join('\n\n'), originalBlob], { type: 'text/html' });
                var url = URL.createObjectURL(blob);
                delete _this.client;
                sessionStorage.setItem('twcloud-dropbox-twits', JSON.stringify(_this));
                location.href = url;
            });
        };
        twits.prototype.loadTiddlywiki = function (data, blob) {
            var self = this;
            //allow-same-origin 
            document.body.innerHTML = "<iframe id=\"twits-iframe\" sandbox=\"allow-same-origin allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-scripts\"></iframe>";
            this.iframe = document.getElementById('twits-iframe');
            this.buildNewBlob(blob, data);
            return true;
            // const inject = `<script src="${
            // 	location.origin + location.pathname.slice(0, location.pathname.lastIndexOf('/'))
            // 	}/tiddly-saver-inject.js?${SCRIPT_CACHE}"><` + `/script>`;
            // this.iframe.src = URL.createObjectURL(new Blob([blob, inject], { type: 'text/html' }));
            // this.iframe.addEventListener('load', (ev) => {
            // });
            // window.addEventListener('message', this.onmessage.bind(this));
            // return true;
        };
        twits.prototype.setupSaving = function () {
            var _this = this;
            // const handle = setInterval(() => {
            // 	if (this.messageSaverReady) clearInterval(handle);
            // 	else this.iframe.contentWindow.postMessage({ message: 'welcome-tiddly-saver' }, this.targetOrigin);
            // }, 1000)
            // window.addEventListener('message', this.onmessage.bind(this));
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
        twits.prototype.onmessage = function (event) {
            var _this = this;
            if (event.data.message === 'save-file-tiddly-saver') {
                this.saveTiddlyWiki(event.data.data, function (err) {
                    event.source.postMessage({ message: 'file-saved-tiddly-saver', id: event.data.id, error: err }, _this.targetOrigin);
                });
            }
            else if (event.data.message === 'thankyou-tiddly-saver') {
                this.messageSaverReady = true;
                if (event.data.isTWC)
                    event.source.postMessage({ message: 'original-html-tiddly-saver', originalText: this.originalText }, this.targetOrigin);
            }
            else if (event.data.message === 'update-tiddly-saver') {
                if (event.data.TW5SaverAdded) {
                    alert("The saver for TW5 has now been added. Changes in TW5 will now be saved as usual.");
                }
            }
        };
        twits.prototype.saveTiddlyWiki = function (text, callback) {
            var _this = this;
            this.setStatusMessage("Saving changes...");
            //TODO: add progress tracker
            this.client.filesUpload({
                path: this.originalPath,
                mode: {
                    ".tag": "update",
                    "update": this.currentRev
                },
                contents: text
            }).then(function (res) {
                _this.clearStatusMessage();
                _this.currentRev = res.rev;
                callback(null);
            }).catch(function (err) {
                console.log(err);
                callback(err.toString());
            });
        };
        return twits;
    }());
    // only load if we are on http or https, otherwise we are probably in a blob
    if (location.protocol.indexOf('http') === 0)
        document.addEventListener("DOMContentLoaded", function (event) {
            var url = new URL(location.href);
            var accessType = url.searchParams.get('type');
            var preload = url.searchParams.get('path');
            if (!accessType)
                return;
            document.getElementById('twits-selector').style.display = "none";
            new twits(accessType, preload && decodeURIComponent(preload));
        }, false);
    else if (location.protocol === "blob:")
        document.addEventListener("DOMContentLoaded", function (event) {
            var sessionstr = sessionStorage.getItem('twcloud-dropbox-twits');
            if (!sessionstr)
                return alert('The session could not be loaded');
            var session = Object.assign(Object.create(twits.prototype), JSON.parse(sessionstr));
            session.client = new Dropbox({
                clientId: session.getKey(),
                accessToken: session.token.access_token
            });
            session.setupSaving();
        }, false);
})(wrapper || (wrapper = {}));
