// JavaScript
define([
    "qlik",
    "./core/d3",
    "./core/ui",
    "./core/qe"
],function (
    qlik,
    d3,
    ui,
    QlikEngine
) {
    'use strict';
    var origin = location.host;
    function Model(){
        var apps = new Apps;
        var sheets = new PropertyList({
        });
        sheets.on("load.setDefaultSheet", function(){
            var currSheetId = qlik.navigation.getCurrentSheetId().sheetId;
            if (this.map.has(currSheetId)){
                var index = this.map.get(currSheetId);
                sheets.selectItem(index);
            }
            else {
                sheets.selectItem(0);
            }
        })
        var objects = new PropertyList({
        });
        objects.on("load.setDefaultObject", function(){
            objects.selectItem(0);
        })
        sheets.on("change.loadObjects", function(){
            var objectInfos = this.qProp.cells.map(function(d) { return d.name });
            objects.upload(objectInfos);
        })
        
        apps.on("openapp", function(){
            var sheetInfos = this.qTypes.get("sheet").qInfos.map(function(d) { return d.qId });
            sheets.setApi(this.api);
            objects.setApi(this.api);
            
            sheets.upload(sheetInfos);
        })
        apps.update();
        
        this.apps = apps;
        this.sheets = sheets;
        this.objects = objects;
    }
    function Apps(){
        var currApp = qlik.currApp();
        var api = new QlikEngine();
        var dispatch = d3.dispatch("reload", "load", "selectstream", "openapp", "selectapp", "error");
        /**
         * Метод для подписки на события
         * reload - начало загрузки списка приложений
         * load - окончание загрузки списка приложений
         * selectstream - выбор потока
         * selectapp - выбор приложения, начало загрузки приложения
         * openapp - окончание загрузки приложения
         * error - ошибка в промисе
        */
        this.on = dispatch.on.bind(dispatch);
        var streams = [];
        var apps = new ui.utils.IndexedArray({ index:function(d) { return d.qDocId } });
        var streamNest = d3.nest().key(function(d) { 
            if (d.qMeta.stream) return d.qMeta.stream.name;
            return "";
        });
        var typeNest = d3.nest().key(function(d) { return d.qType });
        var currentStream;
        var currentApp;
        this.update = function(){
            dispatch.call("reload");
            api.GetDocList().then(function(reply){
                apps.concat(reply.qDocList);
                streams = streamNest.entries(reply.qDocList).map(function(d, i){
                    var stream = d.values[0].qMeta.stream || {name:"Personal"};
                    stream.index = i;
                    stream.currentApp = 0;
                    stream.apps = new ui.utils.IndexedArray({ index:function(d) { return d.qDocId } });
                    stream.apps.concat(d.values);
                    d.values.forEach(function(d){
                        d.stream = stream;
                    })
                    return stream;
                });
                var currStream = apps.get(currApp.id).stream;
                selectStream(currStream.index);
                dispatch.call("load");
            })
        }
        this.selectStream = selectStream;
        function selectStream(index){
            currentStream = streams[index];
            dispatch.call("selectstream");
            var appIndex = 0;
            if (currentStream.apps.map.has(currApp.id)) 
                appIndex = currentStream.apps.map.get(currApp.id);
            selectApp(appIndex);
        }
        this.selectApp = selectApp;
        function selectApp(index){
            //if (currentApp && currentApp.qDocId === currentStream.apps.array[index].qDocId) return;
            currentApp && (delete currentApp.api);
            currentApp = currentStream.apps.array[index];
            currentApp.index = index;
            currentApp.api = new QlikEngine(currentApp.qDocId);
            var qDocId = currentApp.qDocId;
            dispatch.call("selectapp");
            currentApp.api.OpenDoc(currentApp.qDocId).then(openApp)
            .catch(function(e){
                dispatch.call("error", new ModelError(e));
            });
            function openApp(){
                if (currentApp.qDocId != qDocId) return;
                return Promise.all([
                    currentApp.api.GetAppProperties(),
                    currentApp.api.GetAllInfos(),
                ]).then(function(reply){
                    if (currentApp.qDocId != qDocId) return;
                    currentApp.qProp = reply[0].qProp;
                    currentApp.qInfos = reply[1].qInfos;
                    currentApp.qTypes = new ui.utils.IndexedArray({ index:function(d) { return d.qType } });
                    currentApp.qTypes.concat(typeNest.entries(reply[1].qInfos).map(function(d){ return { qType:d.key, qInfos:d.values } }));
                    dispatch.call("openapp", currentApp);
                })
            }
        }
        Object.defineProperty(this, "streamList", {
            get:function() { return streams}
        });
        Object.defineProperty(this, "appList", {
            get:function() { 
                if (currentStream) return currentStream.apps.array; 
                return []
            }
        });
        Object.defineProperty(this, "currentApp", {
            get:function() { return currentApp || {}}
        });
        Object.defineProperty(this, "currentStream", {
            get:function() { 
                return currentStream || {}
            }
        });
        
    }
    function PropertyList(config){
        Properties.call(this, config);
        var selectedIndex = -1;
        this.dispatch.addEvent("change");
        Object.defineProperty(this, "selectedIndex", {
            get:function() { return selectedIndex}
        });
        Object.defineProperty(this, "selectedItem", {
            get:function() { return this.properties.array[selectedIndex] || {} }
        });
        this.selectItem = function(index){
            selectedIndex = index;
            this.dispatch.call("change", this.selectedItem);
        }
        
    }
    function Properties(config){
        config = config || {};
        var self = this;
        var qIdAccessor = config.qIdAccessor || function(d) { return d };
        var uploadFunc = config.uploadFunc || "GetObjectProperties";
        var properties = new ui.utils.IndexedArray({ index:function(d) { return d.qId } });
        var dispatch = d3.dispatch("load", "error");
        this.dispatch = dispatch;
        /**
         * Метод для подписки на события
         * load - окончание загрузки свойств
         * error - ошибка QlikEngine API
        */
        this.on = dispatch.on.bind(dispatch);
        var api;
        this.setApi = function(value) { api = value };
        this.upload = function(qInfos){
            properties.clear();
            properties.concat(qInfos.map(function(d) { return {qId:qIdAccessor(d), qProp:{}}}));
            var queue = qInfos.map(function(d) {
                return api[uploadFunc](qIdAccessor(d));
            });
            Promise.all(queue).then(function(reply){
                reply.forEach(function(d){
                    var qId = d.qProp.qInfo.qId;
                    var property = properties.get(qId);
                    property.qProp = d.qProp;
                })
                dispatch.call("load", properties);
            })
            .catch(function(e){
                dispatch.call("error", new ModelError(e));
            });
        }
        this.setProperties = function(d){
            var id = d.qId;
            api.SetObjectProperties(id, d.qProp)
            .catch(function(e){
                dispatch.call("error", new ModelError(e));
            });
        }
        this.getProperties = function(d){
            var id = d.qId;
            api.GetObjectProperties(id)
            .then(function(reply){
                d.qProp = reply.qProp;
                dispatch.call("load", properties);
            })
            .catch(function(e){
                dispatch.call("error", new ModelError(e));
            });
        }
        Object.defineProperty(this, "properties", {
            get:function() { return properties}
        });
        function ModelError(e){
            if (e instanceof Error){
                this.message = e.message;
                this.stack = e.stack;
                this.type = e.constructor;
            }
            else{
                ui.utils.extend.call(this, e);
            }
            
        }
    }
    return Model;
});
