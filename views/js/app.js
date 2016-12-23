/**
 * Demo application
 */

var app, text, dialogue, response, start, stop;
var SERVER_PROTO, SERVER_DOMAIN, SERVER_PORT, ACCESS_TOKEN, SERVER_VERSION, TTS_DOMAIN;

SERVER_PROTO = 'wss';
SERVER_DOMAIN = 'api-ws.api.ai';
TTS_DOMAIN = 'api.api.ai';
SERVER_PORT = '4435';
ACCESS_TOKEN = '5cc1472ab14a4bd19b116c0d318fee4d';
SERVER_VERSION = '20150910';

window.onload = function () {
    text = $('text');
    dialogue = $('dialogue');
    response = $('response');
    start = $('start');
    stop = $('stop');
    $('server').innerHTML = SERVER_DOMAIN;
    $('token').innerHTML = ACCESS_TOKEN;

    app = new App();
};

function App() {
    var apiAi, apiAiTts;
    var isListening = false;
    var sessionId = ApiAi.generateRandomId();

    this.start = function () {
        start.className += ' hidden';
        stop.className = stop.className.replace('hidden', '');

        _start();
    };
    this.stop = function () {
        _stop();

        stop.className += ' hidden';
        start.className = start.className.replace('hidden', '');
    };

    this.sendJson = function () {
        var query = text.value,
            queryJson = {
                "v": SERVER_VERSION,
                "query": query,
                "timezone": "GMT+9",
                "lang": "en",
                //"contexts" : ["weather", "local"],
                "sessionId": sessionId
            };

        console.log('sendJson', queryJson);

        apiAi.sendJson(queryJson);
    };

    this.open = function () {
        console.log('open');
        apiAi.open();
    };

    this.close = function () {
        console.log('close');
        apiAi.close();
    };

    this.clean = function () {
        dialogue.innerHTML = '';
    };

    _init();


    function _init() {
        console.log('init');

        /**
         * You can use configuration object to set properties and handlers.
         */
        var config = {
            server: SERVER_PROTO + '://' + SERVER_DOMAIN + ':' + SERVER_PORT + '/api/ws/query',
            serverVersion: SERVER_VERSION,
            token: ACCESS_TOKEN,// Use Client access token there (see agent keys).
            sessionId: sessionId,
            lang: 'en',
            onInit: function () {
                console.log("> ON INIT use config");
            }
        };
        apiAi = new ApiAi(config);

        /**
         * Also you can set properties and handlers directly.
         */
        apiAi.sessionId = '1234';

        apiAi.onInit = function () {
            console.log("> ON INIT use direct assignment property");
            apiAi.open();
        };

        apiAi.onStartListening = function () {
            console.log("> ON START LISTENING");
        };

        apiAi.onStopListening = function () {
            console.log("> ON STOP LISTENING");
        };

        apiAi.onOpen = function () {
            console.log("> ON OPEN SESSION");

            /**
             * You can send json through websocet.
             * For example to initialise dialog if you have appropriate intent.
             */
            apiAi.sendJson({
                "v": "20150512",
                "query": "hello",
                "timezone": "GMT+9",
                "lang": "en",
                //"contexts" : ["weather", "local"],
                "sessionId": sessionId
            });

        };

        apiAi.onClose = function () {
            console.log("> ON CLOSE");
            apiAi.close();
        };

        /**
         * Reuslt handler
         */
        apiAi.onResults = function (data) {
            console.log("> ON RESULT", data);

            var status = data.status,
                code,
                speech;

            if (!(status && (code = status.code) && isFinite(parseFloat(code)) && code < 300 && code > 199)) {
                //dialogue.innerHTML = JSON.stringify(status);
                return;
            }

			var googleResult;
			if(data.result.parameters.geocity){
				console.log("data.result.parameter.geocity///"+data.result.parameters.geocity);
				googleResult = _googleApiAjax(data);
				if(undefined != googleResult.weather && googleResult.weather.length>0){
					data.result.fulfillment.speech = data.result.fulfillment.speech.replace("$weather",googleResult.weather[0].description);
				}
				if(undefined != googleResult.list && googleResult.list.length>0){
					var timeSplit = data.result.parameters.timeperiod.split("/");
					var searchIdx = 0;
					var arr = new Array();
					var todayDt = new Date();
					var todayStr = todayDt.getFullYear()+"-"+(todayDt.getMonth()+1)+"-"+todayDt.getDate();
					for(var i = 0; i < googleResult.list.length; i++){
						arr.push(googleResult.list[i].dt_txt);
					}
					if(timeSplit.length>1){
						for(var j = 0; j < arr.length; j++){
							if(todayStr == arr[j].substr(0,10)){
								if( Number(timeSplit[0].substr(0,2)) < Number(arr[j].substr(11,2)) && Number(timeSplit[1].substr(0,2)) > Number(arr[j].substr(11,2)) ){
									searchIdx = j;
								}
							}
						}
						if(undefined != googleResult.list[searchIdx].weather && googleResult.list[searchIdx].weather.length > 0){
							data.result.fulfillment.speech = data.result.fulfillment.speech.replace("$weather",googleResult.list[searchIdx].weather[0].description);
						}
					}
				}
			}
            speech = (data.result.fulfillment) ? data.result.fulfillment.speech : data.result.speech;
            // Use Text To Speech service to play text.
            apiAiTts.tts(speech, undefined, 'en-US');

            dialogue.innerHTML += ('user : ' + data.result.resolvedQuery + '\napi  : ' + speech + '\n\n');
            response.innerHTML = JSON.stringify(data, null, 2);
            text.innerHTML = '';// clean input
        };

        apiAi.onError = function (code, data) {
            apiAi.close();
            console.log("> ON ERROR", code, data);
            //if (data && data.indexOf('No live audio input in this browser') >= 0) {}
        };

        apiAi.onEvent = function (code, data) {
            console.log("> ON EVENT", code, data);
        };

        /**
         * You have to invoke init() method explicitly to decide when ask permission to use microphone.
         */
        apiAi.init();

        /**
         * Initialise Text To Speech service for playing text.
         */
        apiAiTts = new TTS(TTS_DOMAIN, ACCESS_TOKEN, undefined, 'en-US');

    }

    function _start() {
        console.log('start');

        isListening = true;
        apiAi.startListening();
    }

    function _stop() {
        console.log('stop');

        apiAi.stopListening();
        isListening = false;
    }

	function _googleApiAjax(data){
		var googleResult;
		var sslUrl = "http://";
		if(location.href.indexOf("https://")>-1) sslUrl = "https://"
		var apiUrl = sslUrl+"api.openweathermap.org/data/2.5/weather";
		if(undefined != data.result.parameters.timeperiod){
			apiUrl = sslUrl+"api.openweathermap.org/data/2.5/forecast";
		}
		jQuery.ajax({
			method:"get"
			, url:apiUrl
			, data:{APPID:"bc3eddcd4507e4f3892c94de0192536d", q:data.result.parameters.geocity, mode:"json"}
			, async:false
		}).done(function(result){
			googleResult = result;
		});
		return googleResult;
	}

}


function $(id) {
    return document.getElementById(id);
}
