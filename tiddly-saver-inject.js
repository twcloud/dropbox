/*
Parent: welcome-tiddly-saver
		Child: thankyou-tiddly-saver
		if (is TWC) Parent: original-html-tiddly-saver
    
Child: save-file-tiddly-saver
    Parent: file-saved-tiddly-saver
	
*/
(function () {

const ORIGINAL_KEY = 'twcloud-dropbox-original';
const originalHTML = sessionStorage.getItem(ORIGINAL_KEY);
sessionStorage.setItem(ORIGINAL_KEY, '');

window.tweakConfig = function() {
	config.options.chkHttpReadOnly = false;
}

window.addEventListener('load', function () {

	//set tiddlywiki classic to readonly
	// if(typeof config !== "undefined" && config && config.options) config.options.chkHttpReadOnly = false;
	var injectedSaveFile = function (path, content) {
		console.log('injectedSaveFile', path, getLocalPath(location.href) === path)
		if (getLocalPath(location.href) !== path) return false;
		return saver(content, "save", function () {
			(displayMessage || alert)(config.messages.mainSaved || "File saved");
		});
	};
	var injectedLoadFile = function (path) {
		try {
			console.log('injectedLoadFile', path, getLocalPath(location.href) === path);
			if (getLocalPath(location.href) !== path) return false;
			return window.originalHTML;
		} catch (ex) {
			return false;
		}
	};
	var injectedConvertUriToUTF8 = function (path) {
		return path;
	}

	var injectedConvertUnicodeToFileFormat = function (s) {
		return s;
	}

	window.mozillaSaveFile = injectedSaveFile;
	window.mozillaLoadFile = injectedLoadFile;
	window.convertUriToUTF8 = injectedConvertUriToUTF8;
	window.convertUnicodeToFileFormat = injectedConvertUnicodeToFileFormat;

	window.getLocalPath = function (url) {
		return url;
	}

	window.recreateOriginal = function() { return originalHTML }

	window.originalHTML = originalHTML;

	//End TiddlyFox inject.js ========================================================


	var isTW5 = false;
	var isTWC = false;
	var thankyouSent = false;

	var saver = function (text, method, callback, options) {
		var messageBox = document.getElementById("tiddlyfox-message-box");
		if (messageBox) {
			// Create the message element and put it in the message box
			var message = document.createElement("div");
			message.setAttribute("data-tiddlyfox-path", document.location.toString());
			message.setAttribute("data-tiddlyfox-content", text);
			messageBox.appendChild(message);
			// Add an event handler for when the file has been saved
			message.addEventListener("tiddlyfox-have-saved-file", function (event) {
				callback(null);
			}, false);
			// Create and dispatch the custom event to the extension
			var event = document.createEvent("Events");
			event.initEvent("tiddlyfox-save-file", true, false);
			message.dispatchEvent(event);
			return true;
		} else {
			return false;
		}
	};
	var saverObj = {
		info: {
			name: "tiddly-saver",
			priority: 5000,
			capabilities: ["save", "autosave"]
		},
		save: saver
	};
	function addSaver() {
		if ($tw.saverHandler && $tw.saverHandler.savers) {
			$tw.saverHandler.savers.push(saverObj);
			isTW5 = true;
			// if (thankyouSent)
			// 	window.postToParent({ message: 'update-tiddly-saver', TW5SaverAdded: true }, window.parentOrigin);
		} else {
			setTimeout(addSaver, 1000);
		}
	}
	if (typeof ($tw) !== "undefined" && $tw)
		addSaver();
	if (version.title === "TiddlyWiki" && version.major === 2) {
		isTWC = true;
	}
});
})();