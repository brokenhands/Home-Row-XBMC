YUI().use("json","io","transition", "node", "substitute", "history", "array-extras", "HomeRowMenus", function(Y){
    var TypeXBMC = function(el){
        var root = el,
            searchBar = root.one(".search-bar"),
            form = root.one(".search-form"),
            input = root.one(".search-box"),
            results = root.one(".results"),
            template = root.one(".templates .item").cloneNode(true),
            infoBox = root.one(".info-box"),
            backBox = root.one(".back"),
            statusBar = root.one(".status-bar"),
            media = root.one(".media"),
            status = root.one(".status"),
            tools = root.one(".tools"),
            breadCrumbs = root.one(".bread-crumbs"),
            crumbTemplate = breadCrumbs.one(".home").removeClass("home"),
            menuTemplate = root.one(".templates .menu-wrap").cloneNode(true),
            currentMenu,
            historyManager = new Y.HistoryHash(),
            isMobile = !!Y.UA.ipod || !!Y.UA.ipad || !!Y.UA.iphone || !!Y.UA.android || !!Y.UA.mobile;

        var baseJSON = {
                jsonrpc: "2.0",
                method: "",
                "id": 1,
                sort: "ascending"
            },

            buttonMapping = {
                "previous":{postfix:".GoPrevious",msg:"Skip Previous"},
                "skip-back":{postfix:".Seek", params:{value:"bigbackward"},msg:"Skip Back Big"},
                "skip-back-short":{postfix:".Seek", params:{value:"smallbackward"},msg:"Skip Back Small"},
                "play-pause":{postfix:".PlayPause",msg:"Play Pause"},
                "stop":{postfix:".Stop",msg:"Stop"},
                "skip-forward-short":{postfix:".Seek", params:{value:"smallforward"},msg:"Skip Forward Small"},
                "skip-forward":{postfix:".Seek", params:{value:"bigforward"},msg:"Skip Forward Big"},
                "next":{postfix:".GoNext",msg:"Skip Next"}
            },


            types = {
                movies:"Movies",
                tv:"Television",
                music:"Music",
                pictures:"Pictures"
            },

            defaultValue = input.get("value"),

            nodes = [],
            currentNode,
            selectableSubNodes = [],
            selectedSubNode,
            playerID;


        
        var init = function(){
            resize();

            bindUI();

            requestFocus();
            
            open(Y.homeRowMenus);
            
            checkMedia();
        };

        var bindUI = function(){

            Y.on("resize",resize);

            backBox.on("click",function(){
                history.back();
            });

            infoBox.on("click",function(){
                requestFocus();
            });

            form.on("submit", function(e){
                e.preventDefault();
            });

            input.on("blur",blur);
            input.on("focus",focus);
            input.on("keyup", keyHandler);
            input.on("keydown", keyDown);

            tools.on("click", clickTool);

            historyManager.on("history:change", function(e){
                if(e.changed.nodeIndex){
                    var idx = e.changed.nodeIndex.newVal;
                    if(e.src != Y.HistoryBase.SRC_ADD){
                        if(nodes[idx]){
                            back(nodes[idx], true);
                        }else if(idx != 0){
                            back(nodes[nodes.length -1]);
                        }
                    }
                }
            });
        };

        var requestFocus = function(){
            if(!Y.UA.mobile){
                input.focus();
            }
        };
        
        var clickTool = function(e){
            var buttonClass = e.target.get("className").split(" ")[0],
                mapping = buttonMapping[buttonClass];
                params = mapping.params || {};

            bark(mapping.msg);

            params.playerid = playerID;

            getSimpleRPC("Player"+mapping.postfix,{params:params},function(){
                bark(mapping.msg+" Complete");
            });
        };
        
        var checkMedia = function(){
            getSimpleRPC("Player.GetActivePlayers",{},function(results){
                if(!results.length){
                    statusBar.hide(1);
                }else{
                    playerID = results[0].playerid;
                    statusBar.show(1);
                    getSimpleRPC("XBMC.GetInfoLabels",{
                        params:{
                            labels:[
                                "Player.Time",
                                "Player.Duration",
                                "Player.FinishTime",
                                "VideoPlayer.Title",
                                "VideoPlayer.TVShowTitle",
                                "MusicPlayer.Title",
                                "ListItem.Icon",
                                "VideoPlayer.Cover",
                                "MusicPlayer.Cover",
                                "ListItem.Thumb"
                            ]
                        }
                    },function(rslt){
                        var imgURL = rslt["ListItem.Icon"] ||
                                     rslt["ListItem.Thumb"] ||
                                     rslt["MusicPlayer.Cover"] ||
                                     rslt["VideoPlayer.Cover"] ||
                                     null,
                            icon = media.one("p.icon");
                                 
                        if(imgURL){
                            icon.show(1);
                            icon.one("img").set("src",imgURL || null);
                        }else{
                            icon.hide(1);
                        }
                        
                        media.one(".label").set("text",
                            rslt["VideoPlayer.Title"] ? rslt["VideoPlayer.Title"] : rslt["MusicPlayer.Title"]
                        );
                    
                        media.one(".progress").set("text", rslt["Player.Time"]);
                        media.one(".duration").set("text", rslt["Player.Duration"]);
                        media.one(".finish-time").set("text", rslt["Player.FinishTime"]);
                    });
                }
            });
            setTimeout(checkMedia, 3000);
        };
        
        var getSimpleRPC = function(method, obj, cb){
            var jsonObj = Y.clone(baseJSON);

            cb = cb || function(){};

            Y.aggregate(jsonObj, obj, true);
            jsonObj.method = method;

            Y.io("/jsonrpc",{
                method:"POST",
                data:Y.JSON.stringify(jsonObj),
                on:{success:function(id,res){
                    cb(
                        Y.JSON.parse(
                            res.responseText
                        ).result
                    );
                }}
            });
        };

        var getLayeredRPCCall = function(item, command, cb){
            var data;
            item = item || {};
            cb = cb || function(){};

            data = prepCommand(
                command.command,
                gatherParams(
                    item,
                    command
                )
            );

            Y.io("/jsonrpc",{
                data:Y.JSON.stringify(data),
                method:"POST",
                on:{success:function(id, res){
                    cb(
                        Y.JSON.parse(
                            res.responseText
                        )
                    );
                }}
            });
        };
        
        var filter = function(value){
            selectableSubNodes = [];
            
            if(value !== "" || value != defaultValue){
                infoBox.addClass("hide");
                Y.Array.each(currentNode.list, function(subItem){
                    var title = subItem.title || subItem.label || "";
                    if(title.toLowerCase().match(value.toLowerCase())){
                        selectableSubNodes.push(subItem);
                        subItem.listEl.removeClass("hide");
                    }else{
                        subItem.listEl.addClass("hide");
                    }
                });
            }else{
                infoBox.removeClass("hide");
                Y.Array.each(currentNode.list, function(subItem){
                    selectableSubNodes.push(subItem);
                    subItem.listEl.removeClass("hide");
                });
            }
            select(0);
        };
        
        var blur = function(){
            var value = input.get("value");
            if(value === "" || value == defaultValue){
                input.set("value",defaultValue);
            }
        };
        
        var focus = function(){
            var value = input.get("value");
            if(value === "" || value == defaultValue){
                input.set("value","");
            }
        };
        
        var submit = function(e){
            var doOpenMenu = Y.Object.size(selectedSubNode.commands) > 1;
            if(doOpenMenu){
                doOpenMenu = doOpenMenu ? !e.shiftKey : doOpenMenu;
                doOpenMenu = doOpenMenu ? !(e.type === "contextmenu") : doOpenMenu;
                doOpenMenu = isMobile ? doOpenMenu : !doOpenMenu;
            }

            e.preventDefault();

            if(doOpenMenu){
                openMenu();
            }else{
                activateSelected();
            }
        };

        var openMenu = function(){
            if(currentMenu){
                clearMenu();
            }
            currentMenu = new Menu(
                menuTemplate.cloneNode(true),
                selectedSubNode,
                activateSelected
            )
        };

        var clearMenu = function(){
            currentMenu && currentMenu.destroy();
            currentMenu = null;
        };

        var activateSelected = function(command){
            clearMenu();

            if(command == 'cancel'){
                return false;
            }

            if(selectedSubNode.commands[command]){
                switch(command){
                    case 'open':
                        open(selectedSubNode);
                        break;
                    case 'play':
                        play(selectedSubNode);
                        break;
                    case 'queueAndPlay':
                        queueAndPlay(selectedSubNode, true);
                        break;
                    case 'queue':
                        queueAndPlay(selectedSubNode);
                        break;
                    case 'remove' || 'clear':
                        updateRefresh(selectedSubNode, selectedSubNode.commands[command]);
                        break;
                    default:
                        runDefault();
                }
            }else{
                runDefault();
            }

            function runDefault(){
                if(selectedSubNode.commands.getDirectory){
                    if(selectedSubNode.file.match(/[^\/]+$/)){
                        play(selectedSubNode);
                    }else{
                        selectedSubNode.commands.open = selectedSubNode.commands.getDirectory;
                        open(selectedSubNode);
                    }
                }else if(selectedSubNode.commands.open){
                    open(selectedSubNode);
                }else if(selectedSubNode.commands.play){
                    play(selectedSubNode);
                }else if(selectedSubNode.commands.queueAndPlay){
                    queueAndPlay(selectedSubNode, true);
                }else if(selectedSubNode.commands.queue){
                    queueAndPlay(selectedSubNode);
                }
            }
        };

        var keyDown = function(e){
            if(!currentMenu){
                if(input.get("value") === "" && e.keyCode == 8 && nodes.length > 1){
                    history.back();
                }
                if(e.keyCode == 38 || e.keyCode == 40){
                    e.preventDefault();
                    select(
                        Y.Array.indexOf(selectableSubNodes, selectedSubNode) +
                        (e.keyCode == 40 ? 1 : -1)
                    );
                }
            }
        };
        
        var keyHandler = function(e){
            if(!currentMenu){
                if( e.keyCode == 85 && e.shiftKey && e.ctrlKey ){
                    getSimpleRPC("VideoLibrary.Scan",{});
                }else if( e.keyCode == 67 && e.altKey && e.ctrlKey ){
                    alert("clean");
                    getSimpleRPC("VideoLibrary.Clean",{});
                }else if(
                    e.keyCode == 81 &&
                    e.ctrlKey &&
                    selectedSubNode &&
                    (selectedSubNode.commands.queueAndPlay ||
                    selectedSubNode.commands.queue)
                ){
                    if( e.shiftKey ){
                        queueAndPlay(selectedSubNode, true);
                    }else{
                        queueAndPlay(selectedSubNode);
                    }
                }else if((e.keyCode > 45 && e.keyCode < 106) || e.keyCode == 8){
                    filter(input.get("value"));
                }else if(e.keyCode === 13){
                    submit(e);
                    e.stopPropagation();
                }else{
                    e.preventDefault();
                }
            }
        };
        
        var select = function(num){
            num = num < selectableSubNodes.length ? num : 0;
            num = num < 0 ? selectableSubNodes.length -1 : num;
            Y.Array.each(nodes[nodes.length-1].list,function(item){
                item.listEl.removeClass("selected");
            });
            selectedSubNode = selectableSubNodes[num];
            selectedSubNode.listEl.addClass("selected");
            window.scroll(0,selectedSubNode.listEl.getY()-searchBar.get("region").height);
            
        };
        
        var back = function(item, noUpdate){
            nodes.splice(Y.Array.indexOf(nodes,item),nodes.length);
            open(item, noUpdate);
        };

        var updateRefresh = function(item, command){
            getLayeredRPCCall(item, command, function(){
                back(currentNode);
            });
        };
        
        var open = function(item, noUpdate){
            bark("Opening: "+(item.title || item.label || item.name));
            nodes.push(item);
            currentNode = item;

            breadCrumbs.empty();
            var hash = "";
            Y.Array.each(nodes, function(node){
                var crumbEl = crumbTemplate.cloneNode(true)
                    .set("text", node.label || node.name || "none");
                crumbEl.on("click", function(){
                   back(node);
                });
                breadCrumbs.append(crumbEl);
                hash += crumbEl.get("text")+"-";
            });

            results.set("className", item.name.replace(" ","-").toLocaleLowerCase()+" results");

            if(!noUpdate){
                historyManager.add({
                    url:hash
                        .replace(" ","_")
                        .replace(/-$/,""),
                    nodeIndex:nodes.length-1
                });
            }

            if(item.loaded && !item.alwaysRefreshList){
                bark("Opened: "+(item.title || item.label || item.name));
                renderItems(item.list);
            }else{
                var cmd = item.commands.open,
                    params = gatherParams(item, cmd);
                
                getData(cmd.command, params, cmd.properties, function(list){
                    bark("Opened: "+(item.title || item.label || item.name));

                    item.list = item.alwaysRefreshList ? [] : (item.list || []);

                    item.list = item.list.concat(list || []);

                    item.loaded = true;

                    Y.Array.each(item.list, function(subItem,n){
                        subItem.idx = n;
                        Y.aggregate(subItem, item.subItems);
                        if(subItem.inherit){
                            Y.Array.each(subItem.inherit, function(param){
                                if(Y.Lang.isString){
                                    subItem[param] = item[param];
                                }else{
                                    subItem[param.name] = param.fn(item);
                                }
                            });
                        }
                        if(subItem.specialName){
                            subItem.title = Y.substitute(subItem.specialName,subItem);
                        }
                    });
                    if(!item.noSort){
                        item.list.sort(function(a,b){
                            var ta = a.title || a.label,
                                tb = b.title || b.label;
                            if(parseInt(ta, 10) && parseInt(tb, 10)){
                                ta = parseInt(ta, 10);
                                tb = parseInt(tb, 10);
                            }
                            if(tb === ta){
                                return 0;
                            }
                            return  ta > tb ? 1 : -1;
                        });
                    }
                    renderItems(item.list);
                });
            }
        };
        
        var play = function(item){
            bark("Playing: "+(item.title || item.label || item.name));

            getLayeredRPCCall(item, item.commands.play);
            
            input.set("value","");
            requestFocus();
            filter("");
        };

        var queueAndPlay = function(node, play){

            if(node.commands.batchGatherCommand){
                if(play){
                    getSimpleRPC("Playlist.Clear", {params:{playlistid:1}}, batchGather);
                }else{
                    batchGather();
                }
            }else{
                runBatchCall([node])
            }

            function batchGather(){
                getLayeredRPCCall(node, node.commands.batchGatherCommand, function(json){
                    runBatchCall(
                        node.commands.batchGatherCommand.results(json)
                    );
                });
            }

            function runBatchCall(list){
                var data = data = Y.Array.map(list, function(item){
                    return prepCommand(
                        node.commands.batchCommand.command,
                        gatherParams(
                            item,
                            node.commands.batchCommand
                        )
                    );
                });

                Y.io("/jsonrpc",{
                    data:Y.JSON.stringify(data),
                    method:"POST",
                    on:{success:function(id, res){
                        if(play){
                            getSimpleRPC("Player.Open", {params:{item:{playlistid:1}}});
                        }
                    }}
                });
            }
        };

        var queueFile = function(item, cb){
            bark("Queueing Item");
            cb = cb || function(){};
            var jsonObj = prepCommand(item.commands.queue.command,gatherParams(item, item.commands.queue));

            Y.io("/jsonrpc",{
                data:Y.JSON.stringify(jsonObj),
                method:"POST",
                on:{success:function(){
                    cb();
                }
            }});
        };
        
        var gatherParams = function(item, cmd){
            var params = {};


            if(cmd.properties){
                params.properties = cmd.properties;
            }

            if(cmd.params){
                Y.Array.each(cmd.params, function(param){
                    if(Y.Lang.isString(param)){
                        if(item[param] !== null){
                            params[param] = item[param];
                        }else{
                            Y.log("Param not found on item: "+param);
                        }
                    }else{
                        params[param.name] =  param.fn ? param.fn(item) : param.value;
                    }
                });
            }

            return params;
        };
        
        var prepCommand = function(command, params, properties){
            var jsonObj = Y.clone(baseJSON);
            
            jsonObj.method = command;
            jsonObj.params = params || {};
            
            if(properties){
                jsonObj.params.properties = properties;
            }
            
            return jsonObj;
        };

        var getTitle = function(item){
            return item.title || item.label || item.name;
        };

        var getDescription = function(item){
            return item.plot || item.description || "";
        };
        
        var getData = function(command, params, properties, cb){
            cb = cb || function(){};
            
            var jsonObj = prepCommand(command,params,properties);
            
            Y.io("/jsonrpc",{
                data:Y.JSON.stringify(jsonObj),
                method:"POST",
                on:{complete:function(id, response){
                    var json = Y.JSON.parse(response.responseText),
                        newList;
                    Y.each(json.result,function(obj){
                        if(Y.Lang.isArray(obj)){
                            newList = obj;
                        }
                    });
                    Y.Array.each(newList,function(newItem){
                        Y.each(newItem,function(value,param){
                            if(Y.Lang.isString(value) && value.match("special://")){
                                newItem[param] = "/vfs/"+value;
                            }
                        });
                    });
                    cb(newList);
                }}
            });
        };
        
        var renderItems = function(list){
            results.empty();
            Y.Array.each(list, function(item){
                results.append(renderItem(item));
            });
            input.set("value","");
            requestFocus();
            filter("");
        };
        
        var renderItem = function(item){
            var li = template.cloneNode(true),
                thumb = li.one(".thumb"),
                img = li.one(".thumb img"),
                title = li.one(".title");
            li.addClass(item.name.toLocaleLowerCase());
            if(item.thumbnail){
                img.set("src",item.thumbnail || null);
            }else{
                thumb.addClass("no-image");
                thumb.set("text","No image");
            }
            title.set("text",item.title || item.label || "Unknown");
            li.on("click", selectAndSubmit);
            li.on("contextmenu", selectAndSubmit);
            item.listEl = li;
            return li;

            function selectAndSubmit(e){
                selectedSubNode = item;
                submit(e);
            }
        };
        
        var barkTimeout;
        
        var bark = function(msg){
            status.show(1);
            clearTimeout(barkTimeout);
            status.one(".button").set("text",msg);
            barkTimeout = setTimeout(function(){
                status.hide(1);
            }, 2500);
        };
        
        var resize = function(){

        };

        function Menu(root, selectedItem, cb){
            var body = Y.one("body"),
                menuEl = root.one(".menu"),
                menuList = root.one(".menu-options"),
                menuItems = [],
                selected = 0;

            this.destroy = destroy;

            init();

            function init(){
                body.append(root);
                buildMenu();
                select(selected);
                bindUI();
                size();
            }

            function bindUI(){
                body.on("keyup", keyHandler);
                Y.on("resize", size);
                root.on("click",function(e){
                    if(e.target = root){
                        cb('cancel');
                    }
                })
            }

            function execute(n){
                cb(menuItems[n].key);
            }

            function buildMenu(){
                Y.Object.each(selectedItem.commands, bindMenuItem);

                bindMenuItem({}, "cancel");

                menuEl.one(".thumb").set("src", selectedItem.thumbnail || null);
                menuEl.one(".title").set("text", getTitle(selectedItem));
                menuEl.one(".description").set("text", getDescription(selectedItem));
            }

            function bindMenuItem(value, key){
                if(value && !value.hideMenu){
                    var name = value.title || key,
                        option = Y.Node.create('<li>'+name.toUpperCase()+'</li>'),
                        n = menuItems.length;

                    menuList.append(option);
                    menuItems.push(
                        {
                            key:key,
                            el:option
                        }
                    );

                    option.on("click", function(){
                        execute(n);
                    });
                }
            }

            function keyHandler(e){
                if(e.keyCode == 38 || e.keyCode == 40){
                    e.preventDefault();
                    e.stopPropagation();
                    select(e.keyCode == 38 ? -1 : 1);
                }
                if(e.keyCode == 13){
                    e.preventDefault();
                    e.stopPropagation();
                    execute(selected);
                }
                if(e.keyCode == 27){
                    e.preventDefault();
                    e.stopPropagation();
                    cb(false);
                }
            }

            function select(dir){
                menuItems[selected].el.removeClass("selected");
                selected += dir;
                selected = selected < 0 ? menuItems.length - 1 : selected;
                selected = selected > menuItems.length -1 ? 0 : selected;
                menuItems[selected].el.addClass("selected");
            }

            function destroy(){
                body.detach("keyup", keyHandler);
                root.remove().destroy();
                Y.detach("resize", size);
            }

            function size(){
                var vpRegion = Y.DOM.viewportRegion(),
                    menuRegion = menuEl.get("region"),
                    y = (vpRegion.height - menuRegion.height) / 2;

                y = y < 0 ? 50 : y;

                menuEl.setY(window.scrollY + y);
                root.setStyle("height", body.get("region").height < vpRegion.height ? vpRegion.height : body.get("region").height);
            }
        }

        init();
    };
    
    Y.on("domready",function(){
        typeXBMC = new TypeXBMC(Y.one(".type-xbmc"));
    });
});