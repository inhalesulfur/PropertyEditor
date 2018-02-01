define([
    "qlik"
],function (
    qlik
) {
    'use strict';
    var config = {
        host: window.location.host,
        protocol: window.location.protocol === "https:"?"wss:":"ws:"
    };
    function QlikEngine(appId){
        var callbacks;
        var socket;
        var id = 0;
        var origin;
        
        if (appId){
            origin = config.protocol+"//"+config.host+"/app/"+encodeURIComponent(appId)
        }  
        else {
            origin = qlik.currApp().global.session.cacheName;
        }
        var connected = false;
        var status;
        var api = this;
        this.origin = origin;
        this.connect = connect;
        this.request = request;
        function connect(){
            return new Promise(function(resolve, reject){
                callbacks = {};
                status = "connecting";
                socket = new WebSocket(origin);    
                socket.onmessage = messageRouter;
                socket.onopen = function(){
                    status = "connected";
                    connected = true;
                    resolve();
                }
                socket.onerror = function(e){
                    status = "error";
                    reject(e);
                }
            })
        }
        function waitConnect(){
            return new Promise(function(resolve, reject){
                wait();
                function wait(){
                    if (status === "connected"){
                        resolve();
                    }
                    else if (status === "connecting"){
                        setTimeout(wait, 100);
                    }
                    else {
                        reject(status);
                    }
                }
            })
        }
        function messageRouter(reply){
            var data = JSON.parse(reply.data); 
            var requestId = data.id;
            if (callbacks[requestId]){
                callbacks[requestId](data);
                delete callbacks[requestId];
            }
        }
        function request(handle, method, params){
            return new Promise(function(resolve, reject){
                if (status !== "connecting" && status !== "connected") connect().then(sendRequest).catch(function(e) { reject(e) });
                else if (status === "connecting") waitConnect().then(sendRequest).catch(function(e) { reject(e) });
                else sendRequest();
                function sendRequest(){
                    var req = {
                        id:id,
                        handle:handle,
                        method:method,
                        params:params || {}
                    }
                    if (handle === null) reject({ error:"null handle", event:req });
                    socket.send(JSON.stringify(req));
                    callbacks[id] = function(reply){ 
                        if (reply.error) reject(reply.error);
                        else resolve(reply.result);
                    }
                    id++;
                }
            });
            
        }
        this.GetActiveDoc = function (){
            return request(-1, "GetActiveDoc", {});
        }
        this.OpenDoc = function(id){
            return request(-1, "OpenDoc", {
                "qDocName": id,
                "qUserName": "",
                "qPassword": "",
                "qSerial": "",
                "qNoData": false
            });
        }
        this.GetDocList = function (){
            return request(-1, "GetDocList", {});
        }
        this.GetAllInfos = function (){
            return request(1, "GetAllInfos", {});
        }
        this.GetAppProperties = function (){
            return request(1, "GetAppProperties", {});
        }
        this.GetMeasure = function (id){
            return request(1, "GetMeasure", {"qId":id});
        }
        this.GetObject = function (id){
            return request(1, "GetObject", {"qId":id});
        }
        this.GetDimension = function (id){
            return request(1, "GetDimension", {"qId":id});
        }
        this.GetProperties = function (handle){
            return request(handle, "GetProperties", {});
        }
        this.SetProperties = function (handle, qProp){
            return request(handle, "SetProperties", {qProp:qProp});
        }
        this.GetMeasureProperties = function (id){
            return api.GetMeasure(id).then(function(reply){
                if (reply.qReturn.qHandle == null) return promiseReject({error:"null handle", qId:id, reply:reply});
                else return api.GetProperties(reply.qReturn.qHandle)
            })    
        }
        this.GetObjectProperties = function (id){
            return api.GetObject(id).then(function(reply){
                if (reply.qReturn.qHandle == null) return promiseReject({error:"null handle", qId:id, reply:reply});
                else return api.GetProperties(reply.qReturn.qHandle)
            })    
        }
        this.SetObjectProperties = function (id, qProp){
            return api.GetObject(id).then(function(reply){
                if (reply.qReturn.qHandle == null) return promiseReject({error:"null handle", qId:id, reply:reply});
                else return api.SetProperties(reply.qReturn.qHandle, qProp)
            })    
        }
        this.GetDimensionProperties = function (id){
            return api.GetDimension(id).then(function(reply){
                if (reply.qReturn.qHandle == null) return promiseReject({error:"null handle", qId:id, reply:reply});
                else return api.GetProperties(reply.qReturn.qHandle)
            })    
        }
        this.CreateMeasure = function (qProp){
            return request(1, "CreateMeasure", {
                "qProp": qProp
            });
        }
        this.CreateObject = function (qProp){
            return request(1, "CreateObject", {
                "qProp": qProp
            });
        }
        this.CreateDimension = function (qProp){
            return request(1, "CreateDimension", {
                "qProp": qProp
            });
        }
        function promiseReject(e){
            return new Promise(function(resolve, reject){
                reject(e);
            })            
        }
    }
    return QlikEngine;
});
