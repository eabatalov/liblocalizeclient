module.exports.init = init;
module.exports.get = get;

var lll = require('liblocalizelang');
var preprocessDict = lll.preprocessDict;
var interpolateString = lll.interpolateString;

var LOCALES = lll.LOCALES;
module.exports.LOCALES = LOCALES;

var initialized = false;
var localeFilesDirPath = null;
var userLocaleDict = null;

var LOG_TAG = '[LIB_LOCALIZE_CLIENT]';

var LOADING_STATE = {
    tryForceLang: 0,
    tryUserLocale: 1,
    tryDefLocale: 2
};


/**
 *@param {string} defLocaleName The default value; is used when the user's locale is not supported.
 *@param {string} pLocaleFilesDirPath The path to a directory containing a dictionary.
 *@param {function} onReady The callback which is called after the dictionary is loaded(or failed to load).
 *@returns Void.
 */
function init(defLocaleName, pLocaleFilesDirPath, onReady/*(err)*/) {
    localeFilesDirPath = pLocaleFilesDirPath;
    var loadingState = new Number(0);
    var localeName = getUserLocale(defLocaleName, loadingState);
    
    loadLocaleDict(localeName, afterLoading/*(err, dict)*/);
    
    function afterLoading(err, dict) {
        userLocaleDict = dict;
        initialized = !err;
        if(!err) {
            preprocessDict(userLocaleDict);
            onReady(err);
        }
        else if(err && !loadingState.triedUserLocale) {
            console.warn(LOG_TAG, " couldn't load forced locale ", localeName);
            localeName = getUserLocale(defLocaleName, loadingState);
            loadLocaleDict(localeName, afterLoading/*(err, dict)*/);
        }
        else if(err && localeName !== defLocaleName) {
            console.warn(LOG_TAG, " user locale ", localeName, " is not supported. Trying to use the default locale ", defLocaleName);
            localeName = getUserLocale(defLocaleName, loadLocaleState);
            loadLocaleDict(localeName, afterLoading/*(err, dict)*/);
        }
        else {
            console.warn(LOG_TAG, " failed to load the default locale ", defLocaleName);
            onReady(err);
        }
    }
}

/*
 * msgSubstrsDict : { substringKey => substring }
 * returns corresponding message as string
 */
 
/**
 *@param {string} msgKey The key to get a message template from the locale dictionary.
 *@param {string} msgSubstrsDict The dictionary of strings to insert into the message template.
 *@returns {string} The message with the substrings inserted.
 */
function get(msgKey, msgSubstrsDict) {
    if (!initialized) {
        console.warn(LOG_TAG, 'Use of uninitialized lib');
        return '';
    }
    var msgTemplate = userLocaleDict[msgKey];
    if (!msgTemplate) {
        console.warn(LOG_TAG, 'Use of not defined key', msgKey);
        return '';
    }
    return interpolateString(msgTemplate, msgSubstrsDict);
}

function getUserLocale(defLocaleName, loadingState) {
    switch(loadingState) {
        case(LOADING_STATE.tryForceLang ):
            loadingState = LOADING_STATE.tryUserLocale;
            var forceLang = localStorage.getItem('forceLang');
            if(forceLang) {
                console.log(LOG_TAG, " a forced locale ", forceLang, " is detected.");
                return forceLang;
            }
        case(LOADING_STATE.tryUserLocale):
            loadingState = LOADING_STATE.tryDefLocale;
            return getBrowserLocale();
        case(LOADING_STATE.tryDefLocale):
            return defLocaleName;
    }
}

function getBrowserLocale() {
    return (window.navigator.language || window.navigator.browserLanguage).split('-')[0];
}

function isForcedLocale(localeName) {
    return (localeName == localStorage.getItem('forceLang'));
}

function loadLocaleDict(localeName, callback/*(err, dict)*/) {
    jQuery.ajax({
        type: 'GET',
        dataType: 'json',
        url: localeFilesDirPath + localeName + ".json",
        success: onDictDownloaded.bind(null, false),//changed
        error : onDictDownloaded.bind(null, true)//changed
    });

    function onDictDownloaded(err, localeDict) {
        if (err) {
            console.error(LOG_TAG, "Couldn't load locale dictionary", localeDict);
        }
        callback(err, localeDict);
    }
}
