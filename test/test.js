(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"liblocalizelang":2}],2:[function(require,module,exports){
module.exports.preprocessDict = preprocessDict;
module.exports.interpolateString = interpolateString;

/**
 *@namespace
 *@property {string} EN English locale.
 *@property {string} RU Russian locale.
 */
var LOCALES = {
    EN : 'en',
    RU : 'ru'
};
module.exports.LOCALES = LOCALES;


var CONTROL_SYMBOLS = { '#': 'DYNAMIC',
                        '$': 'NO_WHITESPACE',
                        '~': 'ESCAPING_SYMBOL'
};

var SUBSTR_TYPE = {
    "NOT_DYNAMIC_WITH_WHITESPACE": '',
    "DYNAMIC_WITH_WHITESPACE": '#',
    "NOT_DYNAMIC_NO_WHITESPACE": '$',
    "DYNAMIC_NO_WHITESPACE": '#$'
};

var LOG_TAG = '[LIB_LOCALIZE_LANG]';


function DynStr(str, key, isDynamic, needsWhiteSpace) {
    this._staticString = str;
    this.key = key;                
    this.isDynamic = isDynamic; 
    this._needsWhitespace = needsWhiteSpace;
}

DynStr.prototype.setStaticString = function(str) {
    this._staticString = str;
    if(this._needsWhitespace) {
        this._staticString += ' ';
    }
}
    
DynStr.prototype.setKey = function(key) {
    this.key = key;
}

DynStr.prototype.toString = function() {
    return this._staticString;
}            



function isControl(char) {
    for(var controlChar in CONTROL_SYMBOLS) {
        if(char === controlChar) {
            return true;
        }
    }
    return false;
}

function isEscaping(char) {
    if(isControl(char)) {
        return (CONTROL_SYMBOLS[char] === 'ESCAPING_SYMBOL');
    }
    return false;
}

function isControlNotEsc(char) {
    return (isControl(char) && (!isEscaping(char)));
}

function controlSequenceEnded(nextChar, charPresence) {
    //A control sequence is ended when we first meet a non-control symbol.
    //So if a control symbol is repeated the library treats it as a non-control.
    return ((!isControlNotEsc(nextChar)) || charPresence[nextChar]);
}

function removeControlSymbols(str, index) {
    var i = isEscaping(str[index]) ? 1 : 0;
    return str.substring(index + i, str.length);
}

function getStringType(charPresence) {
    var res = '';
    for(var char in CONTROL_SYMBOLS) {
        if(isControlNotEsc(char) && charPresence[char]) {
            res += char;
        }
    }
    return res;
}

function preprocessString(msgTemplate, substrIx) {
    var charPresence = {'#': false, '$': false};
    var curStr = msgTemplate[substrIx];
    
    for(var i = 0; i < curStr.length; ++i) {
        var nextChar = curStr[i];
        if(controlSequenceEnded(nextChar, charPresence)) {
            msgTemplate[substrIx] = removeControlSymbols(curStr, i);
            break;
        }
        charPresence[nextChar] = true;        
    }

    if(i === curStr.length && i > 0) {
        console.warn(LOG_TAG, ' dictionary template string should contain at least one non-control symbol or be empty');
        console.warn(LOG_TAG, ' current string is ', curStr, ' having index ', substrIx, ' in template ', msgTemplate);
        msgTemplate[substrIx] = '';
        return SUBSTR_TYPE["NOT_DYNAMIC_NO_WHITESPACE"];
    }
    
    return getStringType(charPresence);
}

function preprocessMsg(msgTemplate) {
    for(var substrIx = 0; substrIx < msgTemplate.length; ++substrIx) {
        switch(preprocessString(msgTemplate, substrIx)) {
            case SUBSTR_TYPE["NOT_DYNAMIC_WITH_WHITESPACE"]:
                msgTemplate[substrIx] = new DynStr(msgTemplate[substrIx] + ' ', '', false, false);
                break;
            case SUBSTR_TYPE["DYNAMIC_WITH_WHITESPACE"]:
                msgTemplate[substrIx] = new DynStr('', msgTemplate[substrIx], true, true);
                break;
            case SUBSTR_TYPE["NOT_DYNAMIC_NO_WHITESPACE"]:
                msgTemplate[substrIx] = new DynStr(msgTemplate[substrIx], '', false, false);
                break;
            case SUBSTR_TYPE["DYNAMIC_NO_WHITESPACE"]:
                msgTemplate[substrIx] = new DynStr('', msgTemplate[substrIx], true, false);
                break;
        }
    }
}

function preprocessDict(userLocaleDict) {
    for(var i in userLocaleDict) {
        preprocessMsg(userLocaleDict[i]);
    }
}


function interpolateString(msgTemplate, msgSubstrsDict) {
    for (var substrIx = 0; substrIx < msgTemplate.length; ++substrIx) {
        var substrTemplate = msgTemplate[substrIx];
        if(substrTemplate.isDynamic) {
            substrTemplate.setStaticString(msgSubstrsDict[substrTemplate.key]); 
        }
    }
    return msgTemplate.join('');
}


/*
module.exports.test = { preprocessMsg: preprocessMsg,
                        preprocessDict: preprocessDict,
                        interpolateString: interpolateString,
                        DynStr: DynStr
};
*/

},{}],3:[function(require,module,exports){
var llc = require('liblocalizeclient');
var init = llc.init;
var get = llc.get;

var localeDictAnswers = {
  "app_name" : {},

  "scene_new_name": {},
  "scene_delete_confirm": {},

  "button_ok" : {},
  "button_cancel" : {},
  "button_confirm" : {},
  "button_save" : {},

  "edit_mode_edit_name" : {},
  "edit_mode_preview_name" : {},

  "button_save_project" : {},
  "button_publish_project" : {},

  "project_save_dialog_result_success" : {},

  "sound_upload_header" : {},
  "sound_change_btn" : {},
  "sound_upload_action_or" : {},
  "sound_record_btn" : {},
  "sound_choose_btn" : {},
  "sound_choose_open_failed" : {},
  "sound_stop_rec_btn" : {},
  "sound_record_failed" : {},
  "sound_upload_failed" : {},

  "sprite_backet_drop_upload_hint" : {},

  "node_props_text_header" : {},
  "node_props_duration_header" : {},
  "node_props_no_editing" : {},

  "player_autoplay_checkbox_header" : {},
  "player_autoplay_interval_header_before_input" : {},
  "player_autoplay_interval_header_after_input" : {},

  "project_publish_dialog_header" : {},
  "project_publish_dialog_option_clilk" : {},
  "project_publish_dialog_option_video" : {},
  "project_publish_dialog_option_storyboard" : {},
  "project_publish_dialog_hint_select_option" : {},

  "project_publisher_concurrency_error" : {},
  "project_publisher_couldnt_save_project" : {},
  "project_publisher_autoplay_required": {},

  "project_publisher_clilk_working" : {},
  "project_publisher_clilk_finished" : {"htmlHypLink": "WWW.EXAMPLE.COM"},

  "project_publisher_storyboard_safari_not_supported" : {"newLine": "\n"},
  "project_publisher_storyboard_nothing_to_do" : {},
  "project_publisher_storyboard_couldnt_finish" : {},
  "project_publisher_storyboard_creating_archive" : {},
  "project_publisher_storyboard_done" : {"snapshotsCount": 18},
  "project_publisher_storyboard_progress" : {"cntDone": 18, "cntOverall": 42},

  "project_publisher_video_chrome_browser_required" :
    {},
  "project_publisher_video_progress_start" : {},
  "project_publisher_video_progress" : {"secsDone": 18, "secsOverall": 42},
  "project_publisher_video_done" : {"minsCaptured": 18, "secsCaptured": 42},
  "project_publisher_video_work_estim" : {"mins": 18, "secs": 42},

  "project_publisher_audio_doing_rec_setup" : {},
  "project_publisher_audio_couldnt_prepare_sound_bufs" : {},
  "project_publisher_audio_couldnt_start_audio_recording" : {},
  "project_publisher_audio_progress" : {
    "secsCaptured": 18,
    "secsOverall": 42,
	},
  "project_publisher_audio_finished" : {},

  "project_publisher_audio_video_av_merge_not_allowed" : {"avmErrorMsg": "Agh! Bird! Bird! Kill it! It's evil!"},
  "project_publisher_audio_video_finished" : {},

  "project_publisher_audio_video_merger_reg_merge" : {},
  "project_publisher_audio_video_merger_couldnt_start_merge" : {},
  "project_publisher_audio_video_merger_uploading_video" : {},
  "project_publisher_audio_video_merger_couldnt_upload_video" : {},
  "project_publisher_audio_video_merger_uploading_audio" : {},
  "project_publisher_audio_video_merger_couldnt_upload_audio" : {},
  "project_publisher_audio_video_merger_merging" : {},
  "project_publisher_audio_video_merger_couldnt_finish_merge" : {},
  "project_publisher_audio_video_merger_downloading" : {},
  "project_publisher_audio_video_merger_download_progress" : {"percCompleted": 18},
  "project_publisher_audio_video_merger_video_too_long" :
    {},

  "image_mini_editor_dialog_header" : {},
  "image_mini_editor_dialog_tool_mwand_confirm_action" : {},
  "image_mini_editor_dialog_tool_crop_confirm_action" : {},
  "image_mini_editor_dialog_tool_erase_confirm_action" : {},

  "nodes_toolbar_create_hint_phrase" : {},
  "nodes_toolbar_create_hint_free_trans" : {},
  "nodes_toolbar_create_hint_play_sound" : {},
  "nodes_toolbar_create_hint_label" : {},
  "nodes_toolbar_create_hint_notification" : {},
  "nodes_toolbar_create_hint_wait_and_go" : {}
};

var localeDictKeys = [
  "app_name" ,

  "scene_new_name",
  "scene_delete_confirm",

  "button_ok" ,
  "button_cancel" ,
  "button_confirm" ,
  "button_save" ,

  "edit_mode_edit_name" ,
  "edit_mode_preview_name" ,

  "button_save_project" ,
  "button_publish_project" ,

  "project_save_dialog_result_success" ,

  "sound_upload_header" ,
  "sound_change_btn" ,
  "sound_upload_action_or" ,
  "sound_record_btn" ,
  "sound_choose_btn" ,
  "sound_choose_open_failed" ,
  "sound_stop_rec_btn" ,
  "sound_record_failed" ,
  "sound_upload_failed" ,

  "sprite_backet_drop_upload_hint" ,

  "node_props_text_header" ,
  "node_props_duration_header" ,
  "node_props_no_editing" ,

  "player_autoplay_checkbox_header" ,
  "player_autoplay_interval_header_before_input" ,
  "player_autoplay_interval_header_after_input" ,

  "project_publish_dialog_header" ,
  "project_publish_dialog_option_clilk" ,
  "project_publish_dialog_option_video" ,
  "project_publish_dialog_option_storyboard" ,
  "project_publish_dialog_hint_select_option" ,

  "project_publisher_concurrency_error" ,
  "project_publisher_couldnt_save_project" ,
  "project_publisher_autoplay_required",

  "project_publisher_clilk_working" ,
  "project_publisher_clilk_finished" ,

  "project_publisher_storyboard_safari_not_supported" ,
  "project_publisher_storyboard_nothing_to_do" ,
  "project_publisher_storyboard_couldnt_finish" ,
  "project_publisher_storyboard_creating_archive" ,
  "project_publisher_storyboard_done" ,
  "project_publisher_storyboard_progress" ,

  "project_publisher_video_chrome_browser_required" ,
  "project_publisher_video_progress_start" ,
  "project_publisher_video_progress" ,
  "project_publisher_video_done" ,
  "project_publisher_video_work_estim" ,

  "project_publisher_audio_doing_rec_setup" ,
  "project_publisher_audio_couldnt_prepare_sound_bufs" ,
  "project_publisher_audio_couldnt_start_audio_recording" ,
  "project_publisher_audio_progress" ,
  "project_publisher_audio_finished" ,

  "project_publisher_audio_video_av_merge_not_allowed" ,
  "project_publisher_audio_video_finished" ,

  "project_publisher_audio_video_merger_reg_merge" ,
  "project_publisher_audio_video_merger_couldnt_start_merge" ,
  "project_publisher_audio_video_merger_uploading_video" ,
  "project_publisher_audio_video_merger_couldnt_upload_video" ,
  "project_publisher_audio_video_merger_uploading_audio" ,
  "project_publisher_audio_video_merger_couldnt_upload_audio" ,
  "project_publisher_audio_video_merger_merging" ,
  "project_publisher_audio_video_merger_couldnt_finish_merge" ,
  "project_publisher_audio_video_merger_downloading" ,
  "project_publisher_audio_video_merger_download_progress" ,
  "project_publisher_audio_video_merger_video_too_long" ,

  "image_mini_editor_dialog_header" ,
  "image_mini_editor_dialog_tool_mwand_confirm_action" ,
  "image_mini_editor_dialog_tool_crop_confirm_action" ,
  "image_mini_editor_dialog_tool_erase_confirm_action" ,

  "nodes_toolbar_create_hint_phrase" ,
  "nodes_toolbar_create_hint_free_trans" ,
  "nodes_toolbar_create_hint_play_sound" ,
  "nodes_toolbar_create_hint_label" ,
  "nodes_toolbar_create_hint_notification" ,
  "nodes_toolbar_create_hint_wait_and_go" 
];

function onReady(err) {
	if(!err) {
		for(var i = 0; i < localeDictKeys.length; ++i) {
			console.log(get(localeDictKeys[i], localeDictAnswers[localeDictKeys[i]]));
		}
	}
}

init(llc.LOCALES.EN, '../../', onReady);

},{"liblocalizeclient":1}]},{},[3]);
