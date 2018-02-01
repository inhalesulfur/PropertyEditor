define( [ 
    "qlik",
    "./core/d3",
    "./core/ui",
    "./PropertyEditor.m",
    "css!./PropertyEditor.css"
],
function ( 
    qlik,
    d3,
    ui,
    Model
){
    /**
     * Конструктор метаданных экстеншена
     @constructor
    */
	function ExtensionMeta(){
        /**
         * Реестр экземпляров экстеншена
         @private
        */
        var extensions = d3.map();
        
        this.support = {
            snapshot: true,
            export: true,
            exportData : false
        };
        this.paint = function ($element, layout) {
            var qId = layout.qInfo.qId;
            if (!extensions.has(qId)){
                extensions.set(qId, new Extension())
            }
            var extension = extensions.get(qId);
            extension.enter($element[0]);
            extension.setLayout(layout);
            return qlik.Promise.resolve();
        }
        /**
         * Конструктор экстеншена
         @constructor
        */
        function Extension(){
            var module = "PropertyEditor";
            var model = new Model();
            var layout = new ExtensionLayout({
                module:module
            });
            
            var apps = new EditorLayout({
                module:module
            });
            apps.ref.head.update.classed.hide = function() { return model.apps.streamList.length == 0 };
            //apps.ref.title.enter.html = "Приложение";
            model.apps.on("load.apps", apps.update);
            model.apps.on("reload.apps", apps.update);
                        
            var streamSelect = new ui.templates.SelectBox({module:module});
            //streamSelect.ref.select.enter.attr.class = "lui-select";
            streamSelect.ref.select.enter.on.change = function() { model.apps.selectStream(this.selectedIndex) };
            streamSelect.ref.select.update.property.selectedIndex = function() { model.apps.currentStream.index };
            streamSelect.ref.option.data.array = function() { return model.apps.streamList };
            streamSelect.ref.option.update.html = function(d, i) { return d.name };
            model.apps.on("load.streamSelect", streamSelect.update);
            
            var appSelect = new ui.templates.SelectBox({module:module});
            //appSelect.ref.select.enter.attr.class = "lui-select";
            appSelect.ref.select.enter.on.change = function() { model.apps.selectApp(this.selectedIndex) };
            appSelect.ref.select.update.property.selectedIndex = function() { model.apps.currentApp.index };
            appSelect.ref.option.data.array = function() { return model.apps.appList };
            appSelect.ref.option.update.html = function(d, i) { return d.qDocName };
            model.apps.on("selectstream.appSelect", appSelect.update);
            
            var appProperty = new ui.templates.ReqursiveObject({
                constructors:{
                    Object:ui.templates.ObjectEditor,
                    Array:ui.templates.ArrayEditor
                }                
            });
            var appStatus = new ui.templates.ReqursiveObject;
            
            model.apps.on("reload.appProperty", function(){
                appProperty.update({data:{}});
                appStatus.update({data:{"Статус":"Загрузка списка приложений"}});
            });
            model.apps.on("selectapp.appProperty", function(){
                appProperty.update({data:{}});
                appStatus.update({data:{"Статус":"Загрузка приложения"}});
            });
            model.apps.on("error.appProperty", function(){
                appProperty.update({data:{}});
                appStatus.update({data:{"Статус":"Ошибка", error:this}});
            });
            model.apps.on("openapp.appProperty", function(){
                appProperty.update({data:{qProp:model.apps.currentApp.qProp}});
                appStatus.update({data:{}});
            });
            
            var sheets = new EditorLayout({
                module:module
            });
            sheets.ref.head.update.classed.hide = function() { return model.sheets.properties.array == 0 };
            //sheets.ref.title.enter.html = "Лист";
            model.apps.on("reload.sheets", sheets.update);
            model.sheets.on("load.sheets", sheets.update);
            
            var sheetSelect = new ui.templates.SelectBox({module:module});
            //streamSelect.ref.select.enter.attr.class = "lui-select";
            sheetSelect.ref.select.enter.on.change = function() { model.sheets.selectItem(this.selectedIndex) };
            sheetSelect.ref.select.update.property.selectedIndex = function() { return model.sheets.selectedIndex };
            sheetSelect.ref.option.data.array = function() { return model.sheets.properties.array };
            sheetSelect.ref.option.update.html = function(d, i) { return d.qProp.qMetaDef.title };
            model.sheets.on("load.sheetSelect", sheetSelect.update);
            model.sheets.on("change.sheetSelect", sheetSelect.update);
            
            var sheetProperty = new ui.templates.ReqursiveObject({
                constructors:{
                    Object:ui.templates.ObjectEditor,
                    Array:ui.templates.ArrayEditor
                }                
            });
            var sheetStatus = new ui.templates.ReqursiveObject;
            model.apps.on("reload.sheetProperty", function(){
                sheetProperty.update({data:{}});
                sheetStatus.update({data:{}});
            });
            model.apps.on("selectapp.sheetProperty", function(){
                sheetProperty.update({data:{}});
                sheetStatus.update({data:{}});
            });
            model.apps.on("error.sheetProperty", function(){
                sheetProperty.update({data:{}});
                sheetStatus.update({data:{}});
            });
            model.sheets.on("error.sheetProperty", function(){
                sheetProperty.update({data:{}});
                sheetStatus.update({data:{"Статус":"Ошибка", error:this}});
            });  
            model.sheets.on("change.sheetProperty", function(){
                sheetProperty.update({data:{qProp:model.sheets.selectedItem.qProp}});
                sheetStatus.update({data:{}});
            });    
            
            var objects = new EditorLayout({
                module:module
            });
            objects.ref.head.update.classed.hide = function() { return model.objects.properties.array == 0 };
			var tools = new ToolNode({
				tools:["save", "reload"]
			})
			tools.childs.save.enter.on.click = function() {
				var d = model.objects.selectedItem;
				model.objects.setProperties(d);
			}
			tools.childs.reload.enter.on.click = function() {
				var d = model.objects.selectedItem;
				model.objects.getProperties(d);
			}
			objects.ref.body.childs.tools = tools;
			//objects.ref.title.enter.html = "Объект";
            model.apps.on("reload.objects", objects.update);
            model.objects.on("load.objects", objects.update);
            
            var objectSelect = new ui.templates.SelectBox({module:module});
            //streamSelect.ref.select.enter.attr.class = "lui-select";
            objectSelect.ref.select.enter.on.change = function() { model.objects.selectItem(this.selectedIndex) };
            objectSelect.ref.select.update.property.selectedIndex = function() { return model.objects.selectedIndex };
            objectSelect.ref.option.data.array = function() { return model.objects.properties.array };
            objectSelect.ref.option.update.html = function(d, i) { 
                var str = d.qProp.visualization + "::" + d.qProp.qInfo.qId;
                if (d.qProp.title != "") str += "::" + d.qProp.title;
                return str;
            };
            model.objects.on("load.objectSelect", objectSelect.update);
            model.objects.on("change.objectSelect", objectSelect.update);
            
            var objectProperty = new ui.templates.ReqursiveObject({
                constructors:{
                    Object:ui.templates.ObjectEditor,
                    Array:ui.templates.ArrayEditor
                }                
            });
            var objectStatus = new ui.templates.ReqursiveObject;
            model.apps.on("reload.objectProperty", function(){
                objectProperty.update({data:{}});
                objectStatus.update({data:{}});
            });
            model.apps.on("selectapp.objectProperty", function(){
                objectProperty.update({data:{}});
                objectStatus.update({data:{}});
            });
            model.apps.on("error.objectProperty", function(){
                objectProperty.update({data:{}});
                objectStatus.update({data:{}});
            });
            model.sheets.on("change.objectProperty", function(){
                objectProperty.update({data:{}});
                objectStatus.update({data:{"Статус":"Загрузка объектов"}});
            }); 
            model.sheets.on("error.objectProperty", function(){
                objectProperty.update({data:{}});
                objectStatus.update({data:{}});
            });
            model.objects.on("error.objectProperty", function(){
                objectProperty.update({data:{}});
                objectStatus.update({data:{"Статус":"Ошибка", error:this}});
            });  
            model.objects.on("change.objectProperty", function(){
                objectProperty.update({data:{qProp:model.objects.selectedItem.qProp}});
                objectStatus.update({data:{}});
            });    
            
            this.enter = function(parentElement){
                //Проверяем, был ли создан корневой компонент в контейнере экстеншена
                if (d3.select(parentElement).select(layout.ref.wrap.selector).nodes().length) return;
                // Иначе формируем иерархию
                layout.enter(parentElement);
                apps.enter(layout.ref.apps);
                streamSelect.enter(apps.ref.head);
                appSelect.enter(apps.ref.head);
                appStatus.enter(apps.ref.body);
                appProperty.enter(apps.ref.body);
                
                sheets.enter(layout.ref.sheets);
                sheetSelect.enter(sheets.ref.head);
                sheetStatus.enter(sheets.ref.body);
                sheetProperty.enter(sheets.ref.body);
                
                objects.enter(layout.ref.objects);
                objectSelect.enter(objects.ref.head);
                objectStatus.enter(objects.ref.body);
                objectProperty.enter(objects.ref.body);
                model.apps.update();
                
            }
            this.update = function(){
                model.apps.update();
            }
            this.setLayout = function(layout){
            }
            
             /**
             * Макет экстеншена
             * layout.ref.apps - контейнер под редактор приложений
             * layout.ref.sheets - контейнер под редактор листов
             * layout.ref.objects - контейнер под редактор объектов
             @constructor
            */
            function ExtensionLayout(config){
                config = config || {};
                ui.Template.call(this, {
                    factory:"ExtensionLayout", 
                    module:config.module
                });
                this.elements.wrap = new ui.Node({ref:"wrap"});
                this.elements.wrap.childs.apps = new ui.Node({ref:"apps"});
                this.elements.wrap.childs.sheets = new ui.Node({ref:"sheets"});
                this.elements.wrap.childs.objects = new ui.Node({ref:"objects"});
                this.updateRef();
            }
            /**
             * Макет редактора
             * frame.ref.head - заголовок
             * frame.ref.body - тело
             * frame.ref.title - подпись в заголовке
             @constructor
            */
            function EditorLayout(config){
                config = config || {};
                ui.templates.BasicTemplate.call(this, {
                    factory:config.factory || "EditorLayout", 
                    module:config.module,
                    elements:{
                        head:"div",
                        body:"div"
                    }
                });
                this.ref.head.childs.title = new ui.Node({node:"span", ref:"title"});
                this.updateRef();
            }
			function ToolNode(config){
				config = config || {};
				var tools = config.tools || [];
				ui.Node.call(this, {
					node:"div"
				})
				var self = this;
				tools.forEach(function(d, i){
					self.childs[d] = new ui.Node({node:"span", ref:"tools." + d});
					self.childs[d].enter.attr.class = "lui-button";
					self.childs[d].enter.html = d;
				});
			}

            
        }
    }
	return new ExtensionMeta;        
});

