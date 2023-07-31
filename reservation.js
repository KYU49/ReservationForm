/*
    Copyright (c) 2023 KYU @ https://github.com/KYU49

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/agpl-3.0.html>.
*/

// 参考: https://kuroeveryday.blogspot.com/2015/04/JavaScript-MVC.html
// 参考: https://devsakaso.com/javascript-web-application-architecture/#
// 参考: https://lonely-programmer.hatenablog.jp/entry/2016/07/09/193821

(function(){
    // 予約画面に表示する時間範囲
    let START_TIME = 8;
    let END_TIME = 20;
    let FOLD_DAYS = 7;    // 1画面で何日分まで表示するか
    let SMALLEST_MIN = 30;    // 最小の選択可能分数(必ず60の約数にすること)
    let DATABASE_URL = "";
    
    
    let MESSAGE_REQUIRED = "は必須です。";    // 入力必須項目に記載される文言(hogehoge MESSAGE_REQUIREDとなる); 英語とかなら"is/are required."にすればよい。
    let SERVER_ERROR = "サーバーとの通信でエラーが発生しました。";
    let DELETE_CONFIRMATION = "の予約を削除します。";
    const PASS_WORD = "password";

    const isDebug = false;   // trueでサーバー接続せずに、ハードコーディングした適当なテストデータを読み込む


    // start, end: Date Object; startYmd: 20230703; startHM: 1720; from: セル番号

    class Utility {
        static getTodayAsYMD(offset = 0, hyphen = false) {
            let date = new Date();
            date.setDate(date.getDate() + offset);
            return this.date2ymd(date, hyphen);
        }
        static getNowAsHM(offset = 0) { // offsetは分
            let date = new Date();
            date.setMinutes(date.getMinutes() + offset);
            date.setMinutes(date.getMinutes() - date.getMinutes() % SMALLEST_MIN);  // 分の最小単位が決まっているため、それ以下は切り捨てる
            const h = date.getHours();
            const m = date.getMinutes();
        
            const hh = ("00" + h).slice(-2);
            const mm = ("00" + m).slice(-2);
            
            return hh + ":" + mm;
        }
        static date2ymd(date, hyphen = false){
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const d = date.getDate();
        
            const yyyy = y.toString();
            const mm = ("00" + m).slice(-2);
            const dd = ("00" + d).slice(-2);
            if(hyphen){
                return yyyy + "-" + mm + "-" + dd;
            }else{
                return yyyy + mm  + dd;
            }
        }
        static date2hhmm(date, colon = false){
            const hh = ("00" + date.getHours()).slice(-2);
            const mm = ("00" + date.getMinutes()).slice(-2);
            if(colon){
                return hh + ":" + mm;
            }else{
                return hh + mm;
            }
        }
        // 2つのDate objectを引数にとり、前者の年月日と後者の時分を合わせたDate objectを生成
        static mergeYMDdateAndHMdate(ymdDate, hmDate){
            let date = new Date();
            date.setHours(hmDate.getHours());
            date.setMinutes(hmDate.getMinutes());
            date.setFullYear(ymdDate.getFullYear());
            date.setMonth(ymdDate.getMonth());
            date.setDate(ymdDate.getDate());
            date.setSeconds(0);
            return date;
        }

        static ymdhm2date(ymdhm){   // yは4桁
            const dateTimeStr = String(ymdhm);
            const year = dateTimeStr.slice(0, 4);
            const month = dateTimeStr.slice(4, 6) - 1;
            const day = dateTimeStr.slice(6, 8);
            const hour = dateTimeStr.slice(8, 10);
            const minute = dateTimeStr.slice(10, 12);
            return new Date(year, month, day, hour, minute);
        }
        static ymd2date(ymd){   // yは4桁
            const dateTimeStr = String(ymd);
            const year = dateTimeStr.slice(0, 4);
            const month = dateTimeStr.slice(4, 6) - 1;
            const day = dateTimeStr.slice(6, 8);
            return new Date(year, month, day, 0, 0);
        }
        static ymdhmForHuman(ymdhm){    // yは4桁。人が読みやすいように書き換え
            return Utility.ymdhm2date(ymdhm).toLocaleString();
        }

        /*
        * @param time           Date Object
        * @param currentDate    Date Object
        */
        static time2cell(time, currentDate){
            let cellNumInRow = Math.floor( (time.getHours() + time.getMinutes() / 60.0 - START_TIME) * 60 / SMALLEST_MIN );
            const currentDateYmd = new Date(currentDate);
            currentDateYmd.setHours(0);
            currentDateYmd.setMinutes(0);
            const timeYmd = new Date(time);
            timeYmd.setHours(0);
            timeYmd.setMinutes(0);
            const dayOffset = (timeYmd.getTime() - currentDateYmd.getTime()) / 1000 / 60 / 60 / 24;
            const cellNum = cellNumInRow + (END_TIME - START_TIME + 1) * 60 / SMALLEST_MIN * dayOffset
            return cellNum;
        }
        
        static cell2time(cellNum, currentDate, isTo=false){ // END_TIMEのセルが選択されている時、END_TIMEの終わりとSTART_TIMEの始まりの区別がつかないため、isToで判別
            let toOffset = 0;
            if(isTo){
                toOffset = SMALLEST_MIN;
            }
            let time = new Date(currentDate);
            let hour = Math.floor(cellNum * SMALLEST_MIN / 60);
            let minutes = cellNum % (60 / SMALLEST_MIN) * SMALLEST_MIN + toOffset;
            let day = Math.floor(hour / (END_TIME - START_TIME + 1));
            hour = hour % (END_TIME - START_TIME + 1);
            if(hour == 0 && minutes == 0 && isTo){
                hour = (END_TIME - START_TIME + 1);
            }
            time.setHours(START_TIME + hour + day * 24);
            time.setMinutes(minutes);
            return time;
        }
        // 
        static addOffsetToYmd(ymd, offset, hyphen = false){
            const d = Utility.ymd2date(hyphen?ymd.replaceAll(/\-/g, ""):ymd);
            d.setDate(d.getDate() + offset);
            return Utility.date2ymd(d, hyphen);
        }
        static getElementsByInputType(...type){
            const inputs = document.getElementsByTagName("input");
            return Array.from(inputs).filter((e) => type.includes(e.type));
        }
    }

    // ViewでaddEventListnerなどを記述した際は、EventDispatcherにcallbackをつけて登録する。クリックイベントなどをトリガーにDispatcherを介して、Controllerが呼び出され、ControllerがModelのメソッドを呼び出し、結果がcallback関数に渡される。
    class EventDispatcher {
        constructor (){
            this.listeners = {};
            const ADD = "add";
        }
        addEventListener(type, callback){
            if(!this.listeners[type]){
                this.listeners[type] = [];
            }
            this.listeners[type].push(callback);
        }
        removeEventListener(type, callback){
            for(let i = this.listeners[type].length - 1; i >= 0; i--){
                if(this.listeners[type][i] == callback){
                    this.listeners[type].splice(i, 1);
                }
            }
        }
        clearEventListener(){
            this.listeners = [];
        }
        /*
            ディスパッチイベントの実行
            @param event 引数{type: イベントタイプ, [args]: 任意}
        */
        dispatchEvent(event){
            if(isDebug){
                console.log("Dispatch: " + event.type);
            }
            if(this.listeners[event.type]){
                for(let listener in this.listeners[event.type]){
                    this.listeners[event.type][listener].apply(this.listeners, arguments);
                    // applyの参考: https://devsakaso.com/javascript-bind-call-apply-methods/
                }
            }
        }
    }

    // ステートを保存。Controllerからの要求で、外部からのデータ取得。ステートの変更。View, Controllerは見えない。
    class Model extends EventDispatcher {
        static get CONST() {
            return {
                DATE_CHANGED: "dateChanged",
                SET_RESERVATION_DATE: "setReservationDate",
                SET_RESERVATION_TIME: "setReservationTime",
                REFLECT_RESERVATION_ROW: "reflectReservationRow",
                SET_RESERVATION_TEXT_CONTENTS: "setName",
                FINISH_INITIAL_FETCH: "finishInitialFetch",
                REFLECT_RESERVATION_BUTTON: "reflectReservationButton",
                LAST_OPENED_GROUP: "lastOpenedGroup",
                REFLECT_RESERVATION_TIME: "reflectReservationTime",
                TOAST: "toast",
            };
        }
        constructor(){
            super();
            const self = this;
            this.reservationStart = new Date();
            this.reservationEnd = new Date();
            this.currentDate = new Date();
            this.reservationValuesBackup = {};  // 右ペインのテキスト入力項目について、イベント選択時に既に入力されている内容を保存するため
            this.rowsName = [];
            this.events = [];   // [0: [{eventId: , row: 行の名前, row0の予定0のstart: , row0の予定0のend: , others: {}...}, {}, ], 1: [{}, {}], 2: [{}, {}]]
            this.isRowsOpened = []; // 明日以降の予定が表示されているか
            this.currentEventId = -1;   // 変更中の予定のIDを入れる(直接いじらず、enterChangeModeを使うこと)
            this.currentEvent = {group: "", row: "", start: 0, end: 0, others: {}}; // 変更中の予定の値 {eventId: , row0の予定0のstart: , row0の予定0のend: , others: {}
            this.currentGroup = ""; //現在開いている左ペインの部屋などの名前
            this.leftPane = [];     // 左ペイン。[{key: "hoge", name: "hoge" , arr: [{key: "hoge_fuga", name: "huga", arr: ["装置1", "装置2"]}, {}]}, ]
            this.rightPane = [];    // 右ペイン。[{key: "hoge", name: "ほげ", required: false, display: true}, ...], displayはtimelineに表示するか否か
            this.eventContents = [];    // 右ペインの項目のうち、タイムラインに表示する項目のkey (name)
        }

        // idからEventItemとどの機器のEventItemかを返す
        getEventFromId(id){
            for(let i = 0; i < this.events.length; i++){
                const event = this.events[i];
                if(event.eventId == id){
                    return [this.rowsName.indexOf(event.row), event];
                }
            }
            return [-1, null];
        }

        // 現在の日付の変更; ymd: yyyy-mm-dd; initは初期化用
        setCurrentDate(ymd, init=fales){
            // Viewに返すために、Controllerに日付の変更を通知
            this.currentDate = new Date(ymd);    // 左上の現在の日付のDate object
            this.dispatchEvent({type: Model.CONST.DATE_CHANGED, ymd: ymd, init: init});
        }

        /* 右ペインの予約時間を設定
            timelineで指定された値を反映する他、既存予定をクリックした際の反映でも呼ばれる
            @param rows どの予約項目か
            @param start 開始時間(date object)
            @param end 終了時間(date object)
        */
        setReservationDate(start, end){
            // Date Objectでも保持したいため
            this.reservationStart = start;
            this.reservationEnd = end;

            // 保存などに使うため
            this.currentEvent.start = Number(Utility.date2ymd(this.reservationStart) + Utility.date2hhmm(this.reservationStart));
            this.currentEvent.end = Number(Utility.date2ymd(this.reservationEnd) + Utility.date2hhmm(this.reservationEnd));


            this.dispatchEvent({type: Model.CONST.SET_RESERVATION_DATE, start: start, end: end});
        }
        setReservationTime(startH, startM, endH, endM){
            this.reservationStart.setHours(startH);
            this.reservationStart.setMinutes(startM);
            this.reservationEnd.setHours(endH);
            this.reservationEnd.setMinutes(endM);

            // 保存などに使うため
            this.currentEvent.start = Number(Utility.date2ymd(this.reservationStart) + Utility.date2hhmm(this.reservationStart));
            this.currentEvent.end = Number(Utility.date2ymd(this.reservationEnd) + Utility.date2hhmm(this.reservationEnd));

            this.dispatchEvent({type: Model.CONST.REFLECT_RESERVATION_TIME, startHM: ("00" + startH).slice(-2) + ":" + ("00" + startM).slice(-2), endHM: ("00" + endH).slice(-2) + ":" + ("00" + endM).slice(-2)});
        }

        setReservationRow(row){
            this.currentEvent.row = row;
            this.dispatchEvent({type: Model.CONST.REFLECT_RESERVATION_ROW, rows: row});
        }
        setReservationTextContent(key, text){
            let user = {};
            if(!text || text == "null" || text =="undefined"){
                text = "";
            }
            user[key] = text;
            if(key == PASS_WORD){
                this.currentEvent.password = text;
            }else{
                this.currentEvent.others[key] = text;
            }
            this.dispatchEvent({type: Model.CONST.SET_RESERVATION_TEXT_CONTENTS, user: user});
        }

        enterChangeMode(eventId){    // -1を渡すと編集モードから抜ける
            this.currentEventId = eventId;
            this.dispatchEvent({type: Model.CONST.REFLECT_RESERVATION_BUTTON, eventId: eventId});
        }

        setRowOpenState(rowsNum, isOpen){
            this.isRowsOpened[rowsNum] = isOpen;
        }
        
        getDefaultJsonHeaders() { 
            return {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            }
        }

        async loadParameters(){
            const response = await fetch("parameters.txt");
            const responseText = await response.text();
            const parameters = responseText.replaceAll(/\/\*[.\r\n\s]*?\*\/]/g, "").split(/\r\n/);
            let fullName = [];
            let parent = null;
            let gparent = null;
            for(let i = 0; i < parameters.length; i++) {
                const row = parameters[i];
                if(row.length == 0){    // 空行
                    continue;
                }
                const prefix = row.substring(0, 1);

                if(prefix == "-"){    // 右ペインのフォーム内容
                    //<input name="name" type="text" class="required" placeholder=" " /><label>名前</label>
                    const arr = row.replaceAll(/^[\-\s]+/g, "").replaceAll(/\s*,\s*/g,",").split(",");
                    let required = false;
                    let display = false;
                    if(arr.length < 2 || arr[0].length ==0 || arr[1].length == 0){ // 最低でも名前と識別子は必須
                        continue;
                    }
                    if(arr.length > 2){
                        if(arr[2].includes("*")){
                            required = true;
                        }
                        if(arr[2].includes("+")){
                            display = true;
                            this.eventContents.push(arr[1]);    // ここで、タイムラインに表示するものを確認(本当はControllerでやりたい)
                        }
                    }
                    this.rightPane.push(
                        {
                            key: arr[1],
                            name: arr[0],
                            required: required,
                            display: display
                        }
                    );
                    if(arr[1] == PASS_WORD){
                        this.currentEvent.password = "";
                    }else{
                        this.currentEvent.others[arr[1]] = "";
                    }
                }else if(prefix == "$"){
                    const values = row.replaceAll(/^[\$\s]+/g, "").split(/\s*=\s*/);
                    if(values.length < 2){
                        continue;
                    }
                    switch(values[0]){
                        case "START_TIME":
                            START_TIME = Number(values[1]);
                            break;
                        case "END_TIME":
                            END_TIME = Number(values[1]);
                            break;
                        case "FOLD_DAYS":
                            FOLD_DAYS = Number(values[1]);
                            break;
                        case "SMALLEST_MIN":
                            SMALLEST_MIN = Number(values[1]);
                            break;
                        case "DATABASE_URL":
                            DATABASE_URL = values[1];
                            break;
                        case "MESSAGE_REQUIRED":
                            MESSAGE_REQUIRED = values[1];
                            break;
                        case "SERVER_ERROR":
                            SERVER_ERROR = values[1];
                            break;
                        case "DELETE_CONFIRMATION":
                            DELETE_CONFIRMATION = values[1];
                            break;
                    }
                }else{
                    const name = row.match(/(?<=.\s+)[^\[]+/)?.[0]; // 名前の部分
                    const suffix = row.match(/(?<=\[).*?(?=\])/)?.[0];   // カッコ内の文字を取得
                    
                    // 特定の条件でのみ表示する場合はここで早期continue
                    if(suffix){
                        if(!location.search.includes(suffix)){
                            continue;
                        }
                    }
                    if(prefix == "#"){  // 建物名
                        gparent = [];
                        fullName = [name, ""];
                        this.leftPane.push({key: name, name: name, arr: gparent});
                    }else if(prefix == "+"){   // フロア名など
                        if(gparent){
                            parent = [];
                            fullName = [fullName[0], name];
                            gparent.push({key: fullName.join("_"), name: name, arr: parent});
                            fullName.push("");
                        }
                    }else if(prefix == "*"){    // 装置・部屋名など
                        if(parent){
                            fullName[2] = name;
                            parent.push({key: fullName.join("_"), name: name});
                        }
                    }
                }
            }
            this.dispatchEvent({type: Model.CONST.FINISH_INITIAL_FETCH, leftPane: this.leftPane, rightPane: this.rightPane});
        }

        storeName(){
            for(let key in this.currentEvent.others){
                window.localStorage.setItem(key, this.currentEvent.others[key]);
            }
            // チェックボックスの保存
            const google = document.getElementById("google");
            const outlook = document.getElementById("outlook");
            window.localStorage.setItem("google", google && google.checked);
            window.localStorage.setItem("outlook", outlook && outlook.checked);
        }
        restoreSavedName(){
            let flag = true;
            for(let key in this.currentEvent.others){
                const value = window.localStorage.getItem(key);
                if(value){
                    this.setReservationTextContent(key, value);
                    flag = false;
                }
            }
            if(PASS_WORD in this.currentEvent){
                const value = window.localStorage.getItem(PASS_WORD);
                if(value){
                    this.setReservationTextContent(PASS_WORD, value);
                    flag = false;
                }
            }
            if(flag){
                // reservationのテキストコンテンツのうち、必須項目が抜けてる場合にアラートを表示するため。
                this.dispatchEvent({type: Model.CONST.SET_RESERVATION_TEXT_CONTENTS, user: {}});
            }
            
            // チェックボックスの復元
            const google = document.getElementById("google");
            const outlook = document.getElementById("outlook");
            google.checked = google && window.localStorage.getItem("google") == "true";
            outlook.checked = outlook && window.localStorage.getItem("outlook") == "true";
        }

        /*
        * @param dayOffsetStart:int 現在表示中の日付を基準に、何日後からの予定を取得するか
        * @param dayOffsetEnd:int 現在表示中の日付を基準に、何日後までの予定を取得するか
        */
        async loadEventsFetch(dayOffsetStart, dayOffsetEnd, group){
            let resultJson = {};
            const startYmd = Utility.addOffsetToYmd(Utility.date2ymd(this.currentDate), dayOffsetStart);
            const endYmd = Utility.addOffsetToYmd(Utility.date2ymd(this.currentDate), dayOffsetEnd + 1);
            const params = {type: "fetch", start: startYmd + "0000", end: endYmd + "0000", group: group};
            console.log("Fetch: ", params);
            if(isDebug){
                // ローカルテスト用のJSON
                resultJson = JSON.parse('[{"eventId": 100, "row": "A-101", "start": ' + Number(Utility.getTodayAsYMD() + "1100") + ', "end": ' + Number(Utility.getTodayAsYMD() + "1200") + ', "others": {"name": "TestTarou", "domain": "GroupA", "contact": "09012345678"}}, {"eventId": 102,"row": "A-102", "start": ' + Number(Utility.getTodayAsYMD(2) + "1230") + ', "end": ' + Number(Utility.getTodayAsYMD(3) + "0830") + ', "others": {"name": "TestTarou", "domain": "GroupA", "contact": "09012345678"}}, {"eventId": 101, "row": "A-102", "start": ' + Number(Utility.getTodayAsYMD() + "0800") + ', "end":' + Number(Utility.getTodayAsYMD() + "2100") + ', "others": {"name": "TestHanako", "domain": "GroupB", "contact": "09012345678"}}, {"eventId": 103, "row": "A-201", "start": ' + Number(Utility.getTodayAsYMD() + "1200") + ', "end": ' + Number(Utility.getTodayAsYMD() + "1300") + ', "others": {"name": "TestTarou", "domain": "GroupA", "contact": "09012345678"}}]');
            }else{
                const response = await fetch(DATABASE_URL, {
                    method: "post",
                    header: {
                        "content-Type": "application/json"
                    },
                    body: JSON.stringify(params)
                }).catch((e) => this.dispatchEvent({type: Model.CONST.TOAST, text: e + "\n" + SERVER_ERROR}));
                resultJson = await response.json();
            }
            console.log("Response:", resultJson);
            return resultJson;
        }
        async saveEventFetch(){
            let resultJson = {};
            this.storeName();
            const params =  Object.assign({type: "add", eventId: this.currentEventId}, this.currentEvent);
            console.log("Fetch:", params);
            if(isDebug){

            }else{
                const response = await fetch(DATABASE_URL, {
                    method: "post",
                    header: {
                        "content-Type": "application/json"
                    },
                    body: JSON.stringify(params)
                }).catch((e) => this.dispatchEvent({type: Model.CONST.TOAST, text: e + "\n" + SERVER_ERROR}));
                resultJson = await response.json();
            }
            console.log("Response:", resultJson);
            return resultJson;
        }
        async deleteEventFetch(){
            let resultJson = {};
            const params =  {
                type: "delete", 
                eventId: this.currentEventId
            };
            if(this.currentEvent.password){
                params.password = this.currentEvent.password;
            }
            console.log("Fetch:", params);
            if(isDebug){

            }else{
                const response = await fetch(DATABASE_URL, {
                    method: "post",
                    header: {
                        "content-Type": "application/json"
                    },
                    body: JSON.stringify(params)
                }).catch((e) => this.dispatchEvent({type: Model.CONST.TOAST, text: e + "\n" + SERVER_ERROR}));
                resultJson = await response.json();
            }
            console.log("Response:", resultJson);
            return resultJson;
        }

        // 左ペインの前回開いたページのdata-group値を取得
        getLastOpenedGroup(){
            if(window.localStorage){
                const lastOpenedGroup = window.localStorage.getItem(Model.CONST.LAST_OPENED_GROUP);
                if(lastOpenedGroup){
                    return lastOpenedGroup;
                }
            }
            return null;
        }
        setLastOpenedGroup(groupName){
            window.localStorage.setItem(Model.CONST.LAST_OPENED_GROUP, groupName);
        }

        // 左ペーンの配列から指定したGroupの機器/部屋リストを取得
        // leftPane: [{key: "hoge", name: "hoge" , arr: [{key: "hoge_fuga", name: "huga", arr: ["装置1", "装置2"]}, {}]}, ]
        getRowsInGroup(groupName){
            const rowsName = [];
            for(let i in this.leftPane){
                const gparent = this.leftPane[i];
                for(let j in gparent.arr){
                    const parent = gparent.arr[j];
                    if(parent.key == groupName){
                        for(let k in parent.arr){
                            rowsName.push(parent.arr[k].name);
                        }
                    }
                }
            }
            return rowsName;
        }
    }

    // ViewとModelを双方向に繋ぐ。
    class Controller extends EventDispatcher{
        static get CONST() {
            return {
                REND_DATE: "rendDate",
                REFRESH_TIMELINE: "refreshTimeline",
                REFLECT_RESERVATION_DATE: "reflectReservationDate",
                REFLECT_RESERVATION_TIME: "reflectReservationTime",
                REND_TIMELINE_HEADER: "rendTimelineHeader",
                REND_ROWS: "rendRows",
                OPEN_ROWS: "openRows",
                UNSELECT_EVENT: "unselectEvent", // 同じ予定を再選択時のセレクト解除(EventItemのみ)
                UNSELECT_CELL: "unselectCell", // 別の予定を選択時のセレクト解除
                RESTORE_SELECT: "restoreSelect",
                GROUP_SELECTED: "groupSelected",   // 左ペインのグループが選択された時
                REND_LEFT_PANE: "rendLeftPane", // 左ペインを描画
                REND_RIGHT_PANE: "rendRightPane", // 右ペインを初期化
                REND_EVENT_LIST: "rendEventList",
                NOW_LOADING_START: "nowLoadingStart",
                NOW_LOADING_END: "nowLoadingEnd",
                TOAST: "toast",
            };
        }
        constructor(model){
            super();
            this.model = model;
            let self = this;

            // 多くの初期化処理がここ
            this.model.addEventListener(Model.CONST.FINISH_INITIAL_FETCH, (event) => {
                this.dispatchEvent({type: Controller.CONST.REND_TIMELINE_HEADER});
                // 先に左のペーンを描画する
                this.dispatchEvent({type: Controller.CONST.REND_RIGHT_PANE, rightPane: event.rightPane});
                this.dispatchEvent({type: Controller.CONST.REND_LEFT_PANE, leftPane: event.leftPane});

                const lastOpenedGroup = this.model.getLastOpenedGroup();
                if(lastOpenedGroup){
                    this.model.currentGroup = lastOpenedGroup;
                }else{
                    this.model.currentGroup = this.model.leftPane[0]?.arr[0]?.key;
                }

                this.dateChanged(Utility.getTodayAsYMD(0, true), true); // todayを読み込むと、timelineは自動取得

                this.switchGroup(this.model.currentGroup);

                this.model.setReservationDate(new Date(), new Date());
                // hとmを分ける処理を介してmodelに送る
                this.setReservationTimeController(Utility.getNowAsHM(), Utility.getNowAsHM(SMALLEST_MIN));

                this.model.restoreSavedName();
                this.model.enterChangeMode(-1);
            });

            // dateの変更があった場合に、それをViewに反映
            this.model.addEventListener(Model.CONST.DATE_CHANGED, (event) => {
                // 選択領域のリセット後、状態を復帰する。予定をタイムラインから除去はloadevent後の描画処理で実施される
                this.dispatchEvent({type: Controller.CONST.REND_DATE, ymd: event.ymd});
                this.dispatchEvent({type: Controller.CONST.RESTORE_SELECT});
                if(event.init){
                    return;
                }
                this.unselectCell();
                this.loadEvents(0, FOLD_DAYS - 1, this.model.currentGroup);
            });
            
            // event.start, event.endはDate objectで返ってくる
            this.model.addEventListener(Model.CONST.SET_RESERVATION_TIME, (event) => {
                let startHM = Utility.date2hhmm(event.start, true);
                let endHM = Utility.date2hhmm(event.end, true);
                self.dispatchEvent({type: Controller.CONST.REFLECT_RESERVATION_TIME, rows: event.rows, startHM: startHM, endHM: endHM});
            });

            // event.start, event.endはDate objectで返ってくる
            this.model.addEventListener(Model.CONST.SET_RESERVATION_DATE, (event) => {
                const startYMD = Utility.date2ymd(event.start, true);
                const endYMD = Utility.date2ymd(event.end, true);
                
                // Date Objectだから時間も含む
                const startHM = Utility.date2hhmm(event.start, true).split(":").map(Number);
                const endHM = Utility.date2hhmm(event.end, true).split(":").map(Number);
                // setReservationTimeはNumberでhとmを分けて受け取る。
                this.model.setReservationTime(startHM[0], startHM[1], endHM[0], endHM[1]);

                self.dispatchEvent({type: Controller.CONST.REFLECT_RESERVATION_DATE, startYMD: startYMD, endYMD: endYMD});
            });

            this.model.addEventListener(Model.CONST.REFLECT_RESERVATION_TIME, (event) =>{
                this.dispatchEvent({type: Controller.CONST.REFLECT_RESERVATION_TIME, startHM: event.startHM, endHM: event.endHM})
            });
        }
        // 日付の変更を呼び出し、今日の日付を設定。initは初期化用
        dateChanged(value, init = false){
            this.model.setCurrentDate(value, init);
        }
        
        // 現在のページを開き直して更新する。
        reloadTimeline(){
            this.model.events = []; // 初期化
            this.loadEvents(0, FOLD_DAYS - 1, this.model.currentGroup);
        }

        // input dateからの値をそのまま渡す用
        setReservationDateController(startYMD, endYMD){
            let sYMD, eYMD;
            if(!startYMD){
                sYMD = new Date(this.model.reservationStart.getTime());
            }else{
                sYMD = Utility.mergeYMDdateAndHMdate(
                    Utility.ymd2date(startYMD.replaceAll(/-/g, "")),
                    this.model.reservationStart
                );

            }
            if(!endYMD){
                eYMD = new Date(this.model.reservationEnd.getTime());
            }else{
                eYMD = Utility.mergeYMDdateAndHMdate(
                    Utility.ymd2date(endYMD.replaceAll(/-/g, "")),
                    this.model.reservationEnd
                );
            }
            this.model.setReservationDate(sYMD, eYMD);
        }

        // modelのsetReservationTimeがhとmを分ける必要があるため、その自動化
        setReservationTimeController(startHM, endHM){
            let sHM = startHM;
            let eHM = endHM;
            if(!sHM){
                sHM = Utility.date2hhmm(this.model.reservationStart, true);
            }
            if(!eHM){
                eHM = Utility.date2hhmm(this.model.reservationEnd, true);
            }
            const startH = Number(sHM.split(":")[0]);
            const startM = Number(sHM.split(":")[1]);
            const endH = Number(eHM.split(":")[0]);
            const endM = Number(eHM.split(":")[1]);
            this.model.setReservationTime(startH, startM, endH, endM);
        }

        /*
            timelineの選択が終わったことをViewから受け取り、modelに保存、Viewの右ペインに反映
            @param rows 何番目の予約項目か
            @param from 開始時間のセルのindex
            @param to 終了時間のセルのindex
        */
        reservationDateSelected(rows, from, to){
            // Date Objectに変換
            let start = Utility.cell2time(from, this.model.currentDate, false);
            let end = Utility.cell2time(to, this.model.currentDate, true);
            this.model.setReservationRow(this.model.rowsName[rows]);
            this.model.setReservationDate(start, end);
        }

        openRows(rowsNum, isOpen){
            for(let i = 0; i < FOLD_DAYS; i++){
                this.model.setRowOpenState(rowsNum, isOpen);   // 初めて開く場合に読み込みが入るため、modelで実行
            }
            this.dispatchEvent({type: Controller.CONST.OPEN_ROWS, rowsNum: rowsNum, isOpen: isOpen});
        }

        // イベントアイテムがクリックされた場合; 戻り値は既に選択されたイベントをクリックし、選択解除される場合false
        clickEventItem(id){
            // 前回と同じ予定をクリック -> 選択解除
            if(id == this.model.currentEventId){
                // クリック前の入力項目を復元
                for (let key in this.model.reservationValuesBackup) {
                    this.model.setReservationTextContent(key, this.model.reservationValuesBackup[key]);
                }
                this.unselectEvent();
                return false;
            }

            // idから情報を取得
            const rowNumEvent = this.model.getEventFromId(id);
            const rowNum = rowNumEvent[0];
            if(rowNum == -1){
                return;
            }
            const event = rowNumEvent[1];
            const start = Utility.ymdhm2date(event.start);
            const end = Utility.ymdhm2date(event.end);
            if(this.model.currentEventId == -1){
                for(let key in this.model.currentEvent.others){
                    // クリック前の入力項目を復元できるように保存
                    this.model.reservationValuesBackup[key] = this.model.currentEvent.others[key];    // Viewへの反映などないため、直接入力
                }
            }
            for(let key in event.others){
                const value = event.others[key];
                this.model.setReservationTextContent(key, value);
            }
            this.model.setReservationRow(this.model.rowsName[rowNum]);
            this.model.setReservationDate(start, end);
            this.model.enterChangeMode(id);
            this.unselectCell();
            return true;
        }
        // ドラッグドロップで移動させた場合の処理。概ねClickEventと同じ
        moveEventItem(eventId){
            // idから情報を取得
            const rowNumEvent = this.model.getEventFromId(eventId);
            const event = rowNumEvent[1];
            if(this.model.currentEventId == -1){
                for(let key in this.model.currentEvent.others){
                    // クリック前の入力項目を復元できるように保存
                    this.model.reservationValuesBackup[key] = this.model.currentEvent.others[key];    // Viewへの反映などないため、直接入力
                }
            }
            for(let key in event.others){
                const value = event.others[key];
                this.model.setReservationTextContent(key, value);
            }
            this.unselectEvent();
            this.model.enterChangeMode(eventId);

            return true;

        }

        // 時間入力用に選択されているセルを解除
        unselectCell(){
            // setReservationDateによるunselectは不要。右ペインはそのまま表示しておく。
            this.dispatchEvent({type: Controller.CONST.UNSELECT_CELL});
            this.dispatchEvent({type: Controller.CONST.UNSELECT_EVENT});    // 表示だけは消す。currentEventIdは保持
        }

        // 編集用に選択されている予定を解除
        unselectEvent(){
            this.model.enterChangeMode(-1);
            this.dispatchEvent({type: Controller.CONST.UNSELECT_EVENT});
        }

        // 左ペインクリックや初回起動時(Rowのデータの変更が入る)
        switchGroup(groupName){
            this.model.rowsName = this.model.getRowsInGroup(groupName);
            if(this.model.currentGroup != groupName || this.model.isRowsOpened.length == 0){   // 現在のGroupが再選択された場合(日付変更など)は開いているrowを閉じない。isRowOpenedは初期化時なら空なので、初期化タイミングでも実施。
                this.model.isRowsOpened = Array(this.model.rowsName.length).fill(false);
                this.model.currentEvent.row = this.model.rowsName[0];
            }
            this.model.currentGroup = groupName;

            // Groupの選択処理(単に背景色を替えて選択中にするだけ)
            this.model.currentEvent.group = groupName;
            this.dispatchEvent({type: Controller.CONST.GROUP_SELECTED, groupName: groupName});
            
            this.dispatchEvent({type: Controller.CONST.REND_ROWS, rowsName: this.model.rowsName});
            this.dispatchEvent({type: Controller.CONST.RESTORE_SELECT});
            this.loadEvents(0, FOLD_DAYS - 1, groupName);    // FIXME DataChangedの方と重複してる

            for(let i = 0; i < this.model.isRowsOpened.length; i++){
                if(this.model.isRowsOpened[i]){ // 負荷軽減のため、開いているものだけに処理
                    this.openRows(i, true);
                }
            }
        }
        
        async loadEvents(dayOffsetStart, dayOffsetEnd, group){
            this.dispatchEvent({type: Controller.CONST.NOW_LOADING_START});
            const resultJson = await this.model.loadEventsFetch(dayOffsetStart, dayOffsetEnd, group);
            console.log("Fetched Events:", resultJson);
            // JSONで取得した予定リストから、1つずつ予定を読み込む
            for(let i = 0; i < resultJson.length; i++){
                const id = resultJson[i].eventId;
                for(let j = this.model.events.length - 1; j >= 0; j--){
                    const ev = this.model.events[j];
                    if(ev.id == id){   // 同じ予定が存在する場合は削除
                        this.model.events.splice(j, 1);
                    }
                }
                this.model.events.push(resultJson[i]);
            }
            this.dispatchEvent({type: Controller.CONST.REND_EVENT_LIST, events: this.model.events});
            this.dispatchEvent({type: Controller.CONST.NOW_LOADING_END});
        }

        async saveEvent(){
            this.model.storeName();
            this.dispatchEvent({type: Controller.CONST.NOW_LOADING_START}); // endはreloadTimelineで呼ばれる
            const resultJson = await this.model.saveEventFetch();
            this.reloadTimeline();
            // 外部カレンダー登録
            const fe = document.forms.reservationForm.elements;
            if(fe.google.checked){
                this.addGoogleCalendar();
            }
            if(fe.outlook.checked){
                this.addOutlookCalendar();
            }
            this.dispatchEvent({type: Model.CONST.TOAST, text: resultJson[1]});
        }
        async deleteEvent(){
            this.dispatchEvent({type: Controller.CONST.NOW_LOADING_START}); // endはreloadTimelineで呼ばれる
            if(!window.confirm(Utility.ymdhmForHuman(this.model.currentEvent.start) + " " + this.model.currentEvent.row + DELETE_CONFIRMATION)){
                this.dispatchEvent({type: Controller.CONST.NOW_LOADING_END});
                return;
            }
            const resultJson = await this.model.deleteEventFetch();
            this.unselectEvent();
            this.reloadTimeline();
            this.dispatchEvent({type: Model.CONST.TOAST, text: resultJson[1]});
        }
        addGoogleCalendar(){
            const ev = this.model.currentEvent;
            const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${ev.row}&location=${ev.row}&dates=${String(ev.start).slice(0, 8)}T${String(ev.start).slice(-4)}00/${String(ev.end).slice(0, 8)}T${String(ev.end).slice(-4)}00`;
            window.open(url);
        }
        addOutlookCalendar(){
            const ev = this.model.currentEvent;
            const start = String(ev.start);
            const end = String(ev.end);
            const startdt = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T${start.slice(8, 10)}:${start.slice(10, 12)}:00:00`;
            const enddt = `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T${end.slice(8, 10)}:${end.slice(10, 12)}:00:00`; 
            const url = `https://outlook.office.com/calendar/action/compose?subject=${ev.row}&location=${ev.row}&startdt=${startdt}&enddt=${enddt}`;
            window.open(url);
        }

        // LeftPane読み込みが律速のため、loadParameters終了後に呼び出されるdispatchEventで処理
        onload(){
            this.model.loadParameters();
        }
    }

    // Controllerからの要求で、Viewの変更を反映。Model, Controllerは見えない。ユーザーからのクリックなどによるControllerへの要求はEventDispatcherを介す。
    // modelは渡すが、model.addEventListenr("click", function(){~})以外の形では使用しないこと。
    class View extends EventDispatcher {
        static get CONST() {
            return {
                ID_PREFIX: "event_",
            };
        }
        constructor(model, controller) {
            super();
            this.model = model;
            this.controller = controller;

            // DOM elementの取得
            this.dateInput = document.forms.currentDate.elements.date;
            this.timeline = document.getElementById("timeline");
            this.formFromYMD = document.forms.reservationForm.elements.from_ymd;
            this.formToYMD = document.forms.reservationForm.elements.to_ymd;
            this.formFromTime = document.forms.reservationForm.elements.from_time;
            this.formToTime = document.forms.reservationForm.elements.to_time;


            this.selector = new Selector(this);
            this.dragSelector = new DragSelector(this);
            document.addEventListener("mouseup", (event) => this.selector.mouseup(event), true);  // 範囲外でマウスアップされた時用

            this.initializeControllerEventListener();
            this.initializeModelEventListener();
            
            // 日付の変更をControllerに通知する処理
            this.dateInput.addEventListener("change", (event) => {
                // 戻ってきた値で再変更されるが、同じ値が入るためchangeは走らない
                this.controller.dateChanged(event.currentTarget.value);
            });
            // 今日ボタン。
            document.getElementById("moveToToday").addEventListener("click", (e) => {
                this.controller.dateChanged(Utility.getTodayAsYMD(0, true));
            });
        }

        // Controllerから呼び出すcallbackを設定
        initializeControllerEventListener(){    
            const self = this;

            // 時間バーを描画
            this.controller.addEventListener(Controller.CONST.REND_TIMELINE_HEADER, (event) => {
                let timeline_header = document.getElementById("timeline_header");
                // 1つ目は部屋名などが入る太めの部分
                let ele = document.createElement("div");
                ele.classList.add("timeline_header_label");
                timeline_header.appendChild(ele);
                for(let i = START_TIME; i <= END_TIME; i++){
                    let ele = document.createElement("div");
                    ele.innerText = i;
                    timeline_header.appendChild(ele);
                }
            });

            // 日付の変更を反映
            this.controller.addEventListener(Controller.CONST.REND_DATE, (event) => {
                self.dateInput.value = event.ymd;
            });

            // 予約時間の反映
            this.controller.addEventListener(Controller.CONST.REFLECT_RESERVATION_DATE, (event) => {
                self.formFromYMD.value = event.startYMD;
                self.formToYMD.value = event.endYMD;
            });
            this.controller.addEventListener(Controller.CONST.REFLECT_RESERVATION_TIME, (event)=> {
                // event.start, event.endはmm:ddに変換されて帰ってくる
                self.formFromTime.value = event.startHM;
                self.formToTime.value = event.endHM;
            });
            this.controller.addEventListener(Controller.CONST.UNSELECT_EVENT, (event) => {
                this.removeSelection(true, false)
            });
            this.controller.addEventListener(Controller.CONST.UNSELECT_CELL, (event) => {
                this.removeSelection(false, true)
            });
            this.controller.addEventListener(Controller.CONST.REND_LEFT_PANE, (event) => {
                const roomList = event.leftPane;
                const eleContainer = document.getElementById("group_list");

                for(let i = 0; i < roomList.length; i++) {
                    const section = roomList[i];
                    const eleSection = document.createElement("li");
                    eleSection.classList.add("section");
                    eleSection.innerHTML = section.name;
                    eleSection.appendChild(document.createElement("ul"));
                    eleContainer.appendChild(eleSection);

                    for(let j = 0; j < section.arr.length; j++){
                        const group = section.arr[j];
                        const li = document.createElement("li");
                        li.classList.add("group");
                        li.setAttribute("data-group", group.key);
                        li.innerHTML = group.name;
                        eleSection.lastChild.appendChild(li);
                    }
                }
                
                this.initializeLeftPane();  // 左ペインの初期化
            });

            this.controller.addEventListener(Controller.CONST.REND_RIGHT_PANE, (event) => {
                //<input name="name" type="text" class="required" placeholder=" " /><label>名前</label>
                const formText = event.rightPane;
                const container = document.getElementById("text_form");
                for(let i = 0; i < formText.length; i++){
                    const form = formText[i];
                    const ele = document.createElement("input");
                    const label = document.createElement("label");
                    if(form.key == PASS_WORD){
                        ele.type = PASS_WORD;
                    }else{
                        ele.type = "text";
                    }
                    ele.placeholder = " ";
                    ele.name = form.key;
                    label.innerHTML = form.name;
                    if(form.required){
                        ele.classList.add("required");
                    }
                    container.appendChild(ele);
                    container.appendChild(label);
                }
                this.initializeRightPane();
            });

            // 行を開く処理。初めて開くときは読み込みが入るし、数日にまたがる予約をクリックした際も開く必要があるため、Controllerに処理を委任。
            this.controller.addEventListener(Controller.CONST.OPEN_ROWS, (event) => {
                self.openRows(event.rowsNum, event.isOpen);
            });
            this.controller.addEventListener(Controller.CONST.GROUP_SELECTED, (event) => {
                const groups = document.getElementsByClassName("group");
                for(let i = 0; i < groups.length; i++){
                    const group = groups[i];
                    group.classList.remove("group_selected");
                    if(event.groupName == group.dataset.group){
                        group.classList.add("group_selected");
                    }
                }
            });

            // timelineの行を描画するとともに、formのrow選択pulldownも初期化する
            this.controller.addEventListener(Controller.CONST.REND_ROWS, (event) =>{
                let timeline_main = document.getElementById("timeline_main");
                let rowsForm = document.getElementById("rows_pulldown");

                // 前のGroupの行が残っていたら初期化
                while(timeline_main.lastChild){
                    timeline_main.removeChild(timeline_main.lastChild);
                }
                while(rowsForm.lastChild){
                    rowsForm.removeChild(rowsForm.lastChild);
                }

                event.rowsName.forEach((row) => {
                    // 行の描画処理
                    this.rendRows(row);
                    // 右ペイン上部の切り替え作成
                    let op = document.createElement("option");
                    op.value = row;
                    op.innerText = row;
                    rowsForm.appendChild(op);
                    // 選択の復元
                    if(row == this.model.currentEvent.row){
                        rowsForm.value = row;
                    }
                });
            });
            this.controller.addEventListener(Controller.CONST.RESTORE_SELECT, () => {
                this.selector_rend(
                    this.model.rowsName.indexOf(this.model.currentEvent.row),
                    Utility.time2cell(this.model.reservationStart, this.model.currentDate),
                    Utility.time2cell(this.model.reservationEnd, this.model.currentDate) - 1
                );
            });

            // 画面切り替えを呼ぶと、timelineがリフレッシュされる
            this.controller.addEventListener(Controller.CONST.REFRESH_TIMELINE, (event) =>{
                this.controller.switchGroup(this.model.currentGroup);
            });

            // 取得したイベントの描画
            this.controller.addEventListener(Controller.CONST.REND_EVENT_LIST, (event)=> {
                const events = event.events;
                const timelineRows = document.getElementsByClassName("timeline_rows");
                const maxLength = (END_TIME - START_TIME + 1) * 60 / SMALLEST_MIN;  // 左から右までの最大長

                // 日付を変更した場合などに、前回のデータが残っている可能性があるため、全て除く。
                const timelineEvents = document.getElementsByClassName("timeline_event");
                for(let i = timelineEvents.length - 1; i >= 0; i--){
                    timelineEvents[i].remove();
                }
                for (let i = 0; i < events.length; i++){    // events内のデータを順に取得
                    const ev = events[i];
                    let startCellNum = Utility.time2cell(Utility.ymdhm2date(ev.start), this.model.currentDate);      // 予約開始時間のセルを取得
                    const endCellNum = Utility.time2cell(Utility.ymdhm2date(ev.end), this.model.currentDate);   // 予約終了時間のセルを取得
                    const rowNum = this.model.rowsName.indexOf(ev.row);
                    // 該当する部屋・機器が存在しない場合
                    if(rowNum == -1){
                        continue;
                    }
                    const targetRow = timelineRows[rowNum];  // どの部屋・装置か
                    const targetCells = targetRow.getElementsByClassName("timeline_cell");  // 対象の部屋・装置のcellを全て取得

                    for(let j = 0; j < FOLD_DAYS; j++){
                        // 描画処理
                        const ele = this.createEventElement(ev, j);
                        if(!ele){   // その日にちに予定が入らない場合は次の日に進む
                            continue;
                        }      
                        const firstCellNum = j * maxLength;
                        if(startCellNum < firstCellNum){  // 画面上に表示されない位置の予定でも、終わりが画面上に表示されるのであれば、0の位置に入れる
                            startCellNum = firstCellNum;
                        }
                        const parentCell = targetCells[startCellNum];
                        parentCell.appendChild(ele);
                    }
                }
            });

            this.controller.addEventListener(Controller.CONST.NOW_LOADING_START, () => {
                document.getElementById("loading").style.display = "flex";
            });
            this.controller.addEventListener(Controller.CONST.NOW_LOADING_END, () => {
                document.getElementById("loading").style.display = "none";
            });

            this.controller.addEventListener(Controller.CONST.TOAST, (event) => {
                this.showToast(event.text);
            });
        }

        initializeModelEventListener(){
            const self = this;
            // model.currentEvent.othersに変化があった場合(or 初期化時)、変化があった値が通知され、Viewに反映する。
            this.model.addEventListener(Model.CONST.SET_RESERVATION_TEXT_CONTENTS, (event) => {
                // formの長さが可変だから、配列で処理
                for(let key in event.user){
                    var val = event.user[key]; // this は event.user
                    let ele = document.getElementsByName(key);
                    if(ele && ele.length > 0){
                        ele[0].value = val;
                    }
                }
                
                const warning = document.getElementById("warning");
                const reserve = document.getElementById("reserve");
                const change = document.getElementById("change");
                const req = document.getElementsByClassName("required");
                reserve.disabled = false;
                change.disabled = false;
                warning.style.display = "none";
                let warningText = MESSAGE_REQUIRED;
                for(let i = req.length - 1; i >= 0; i--){
                    let form = req[i];
                    if(form.value.length == 0){
                        reserve.disabled = true;
                        change.disabled = true;
                        warning.style.display = "inline-block";
                        let ph = form.getAttribute("placeholder");
                        if(!ph || !ph.replaceAll(/\s/g,"")){    // placeholderでなく、labelで指定しているときは次の要素
                            ph = form.nextElementSibling.innerText;
                        }
                        warningText = ", " + ph + warningText;
                    }
                }
                warning.innerText = warningText.substring(1);
            });

            this.model.addEventListener(Model.CONST.REFLECT_RESERVATION_BUTTON, (event) => {
                this.reflectReservationButton(event.eventId);
            });
            this.model.addEventListener(Model.CONST.REFLECT_RESERVATION_ROW, (event) => {
                document.getElementById("rows_pulldown").value = event.rows;
            });
            this.model.addEventListener(Model.CONST.TOAST, (event) => {
                this.showToast(event.text);
            });
        }

        showToast(text, time=2000){
            const toast = document.getElementById("toast");
            toast.classList.add("active");
            const toastText = document.getElementById("toast_text")
            toastText.innerText = text;
            const timeout = setTimeout(function(){
                toast.classList.remove("active");
            }, time);
            toast.onclick = function(){
                toast.classList.remove("active");
                clearTimeout(timeout);
            }
        }

        /* 
        * timelineとtimeline上のイベントの選択状態を解除する
        * @param eventItem 赤くなっているEventItemをリセット
        * @param timelineCell 赤くなっている背景のTimelineCellをリセット
        */
        removeSelection(eventItem=true, timelineCell=true){
            if(eventItem){
                const previousSelected = document.getElementsByClassName("timeline_event_selected");
                while(previousSelected && previousSelected.length > 0){
                    previousSelected[0].classList.remove("timeline_event_selected");
                }
            }
            if(timelineCell){
                const cells = document.getElementsByClassName("timeline_selected");
                while(cells && cells.length > 0){
                    cells[0].classList.remove("timeline_selected");
                }
            }
        }

        /*
        * @param ev         イベントの内容が入った連想配列{id, rows (部屋・装置名など), start, end, others: {}}
        * @param dateRowNum 何行目(何日目)の予定として作成するか
        */
        createEventElement(ev, dateRowNum){
            const maxLength = (END_TIME - START_TIME + 1) * 60 / SMALLEST_MIN;  // 左から右までの最大長
            const firstCell = dateRowNum * maxLength;
            const lastCell = (dateRowNum + 1) * maxLength - 1;
            const ele = document.createElement("div");
            ele.classList.add("timeline_event");
            let startCell = Utility.time2cell(Utility.ymdhm2date(ev.start), this.model.currentDate);
            if(startCell < firstCell){
                startCell = firstCell;
            }
            let endCell = Utility.time2cell(Utility.ymdhm2date(ev.end), this.model.currentDate) - 1;
            if(lastCell < endCell){
                endCell = lastCell;
            }
            const eventLength = endCell - startCell + 1;
            if(eventLength <= 0){
                return null;
            }

            ele.style.width = "calc(" + eventLength * 100 + "% + " + eventLength + "px)";   // cellのboader分だけここで足している。
            const id = ev.eventId;
            ele.classList.add(View.CONST.ID_PREFIX + id);   // 数日にまたがるイベントを取得するために、同じ予定には同じclassを指定する。
            ele.dataset.eventId = id;

            // クリック操作関連の追加
            ele.addEventListener("click", (e)=>{
                if(this.controller.clickEventItem(id)){
                    this.rendEventSelectToEventElement(id);
                }
            });
            ele.draggable = true;
            ele.addEventListener("dragstart", (event) =>{
                this.dragSelector.dragstart(event);
            });
            ele.addEventListener("drag", (event) =>{
                this.dragSelector.drag(event);
            });
            
            const textEle = document.createElement("div");
            if(this.model.eventContents.length > 0){  // このコード上部で最初に指定した項目を描画
                let innerText = ev.others[this.model.eventContents[0]];
                for(let i = 1; i < this.model.eventContents.length; i++){
                    let tempOther = ev.others[this.model.eventContents[i]]
                    if(!tempOther){
                        tempOther = "";
                    }
                    innerText += "\n" + tempOther;
                }
                textEle.innerText = innerText;
            }

            // 日付を変更した場合などのリロード時、リロード前から選択中なら再選択する。
            if(this.model.currentEventId == id){
                ele.classList.add("timeline_event_selected");
            }

            ele.appendChild(textEle);
            return ele;
        }
        rendEventSelectToEventElement(id){
            // 同じclassを有する要素を全て選択状態に切り替える
            const target = document.getElementsByClassName(View.CONST.ID_PREFIX + id);
            for(let i = 0; i < target.length; i++){
                target[i].classList.add("timeline_event_selected");
            }
        }

        openRows(rowsNum, isOpen){
            let rows = document.getElementsByClassName("timeline_rows")[rowsNum];
            if(isOpen){
                rows.firstChild.firstChild.classList.add("timeline_label_close");
            }else{
                rows.firstChild.firstChild.classList.remove("timeline_label_close");
            }
            for (let i = 1; i < rows.children.length; i++){
                let row = rows.children[i];
                if(isOpen){
                    row.classList.remove("timeline_row_hide");
                }else{
                    row.classList.add("timeline_row_hide");
                }
            }
        }

        /*
            @param rowsNum 選択中の予約項目のindex
            @param startTime 開始時間のセルのindex
            @param endTime 終了時間のセルのindex
        */
        selector_rend(rowsNum, startTime, endTime){
            // 別の行にマウスが行った際にその行の時間を取得して、今の行に反映するのを防ぐ。
            // selectorと無関係に選択している場合(selector.rowNum == -1)は無視して実行
            if(this.selector.rowNum != rowsNum && this.selector.rowNum != -1){
                return;
            }
            let rows = document.getElementsByClassName("timeline_rows")[rowsNum];
            if(!rows){  // 初期化時など
                return;
            }
            let cells = rows.getElementsByClassName("timeline_cell");
            let selection_start = startTime;
            let selection_end = endTime;
            if (selection_end < selection_start){
                let temp = selection_start;
                selection_start = selection_end;
                selection_end = temp;
            }
            for(let i = 0; i < cells.length; i++){
                if(selection_start <= i && i <= selection_end){
                    cells[i].classList.add("timeline_selected");
                } else {
                    cells[i].classList.remove("timeline_selected");
                }
            }
        }
        /*
            時間に変更した状態で、Controllerに渡し、ControllerからModelに値を保存、Controllerからの戻り値を以て、右ペインの現在時刻に反映する。
            @param rowsNum 選択中の予約項目のindex
            @param startTime 開始時間のセルのindex
            @param endTime 終了時間のセルのindex
        */
        selector_reflect(rowsNum, from, to){
            this.controller.reservationDateSelected(rowsNum, from, to);
        }

        mouseStalkerRend(e, from, to){            
            //イベントオブジェクトを参照し、カーソル位置情報を取得
            const mousePosX = e.clientX;
            const mousePosY = e.clientY;  
            const mouse = document.getElementById("mouseStalker");
            mouse.classList.add("active");
            const mouseWidth = mouse.clientWidth;
            const cssPosAjust = mouseWidth / 2;
            const x = mousePosX - cssPosAjust;
            const y = mousePosY - mouse.clientHeight;

            //カーソルの位置情報を「mouseStalker」に反映
            mouse.style.left = x + "px";
            mouse.style.top = y + "px";
            mouse.innerText = from + "-" + to;
        }
        mouseStalkerHide(){
            const mouse = document.getElementById("mouseStalker");
            mouse.classList.remove("active");
        }

        // 予約項目を描画
        rendRows(name){
            const timeline_main = document.getElementById("timeline_main");
            const timeline_rows = document.createElement("div");
            timeline_rows.classList.add("timeline_rows");
            for(let i = 0; i < FOLD_DAYS; i++){
                const timeline_row = document.createElement("div");
                timeline_row.classList.add("timeline_row");

                // 1つ目は部屋名などが入る太めの部分
                const ele = document.createElement("div");
                // 2行目からは同一の部屋の翌日以降のタイムライン
                if(i == 0){
                    ele.innerHTML = name;
                    ele.classList.add("timeline_label");
                    this.model.isRowsOpened.push(false);
                    ele.addEventListener("click", (event) => {
                        let rows = event.currentTarget.parentElement.parentElement;
                        let rowNums = [].slice.call(document.getElementsByClassName("timeline_rows")).indexOf(rows);
                        this.controller.openRows(rowNums, !this.model.isRowsOpened[rowNums]);
                        if(this.model.isRowsOpened[rowNums]){
                            event.currentTarget.innerHTML = Utility.date2ymd(this.model.currentDate, true) + "<br>" + name;
                        }else{
                            event.currentTarget.innerHTML = name;
                        }
                    });
                    this.model.addEventListener(Model.CONST.DATE_CHANGED, (event) => {
                        let rowNums = [].slice.call(document.getElementsByClassName("timeline_rows")).indexOf(timeline_rows);
                        if(this.model.isRowsOpened[rowNums]){
                            ele.innerHTML = Utility.addOffsetToYmd(event.ymd, 0, true) + "<br>" + name;
                        }else{
                            ele.innerHTML = name;
                        }
                    });
                }else{
                    ele.innerText = Utility.addOffsetToYmd(Utility.date2ymd(this.model.currentDate), i, true);
                    ele.classList.add("timeline_label_date");
                    this.model.addEventListener(Model.CONST.DATE_CHANGED, (event) => {
                        ele.innerText = Utility.addOffsetToYmd(event.ymd, i, true);
                    });
                    timeline_row.classList.add("timeline_row_hide");
                }
                timeline_row.appendChild(ele);
                for(let j = START_TIME; j <= END_TIME; j++){
                    for(let k = 0; k < 60 / SMALLEST_MIN; k++){ // 30 minごと
                        const cell = document.createElement("div");
                        cell.classList.add("timeline_cell");
                        cell.style.zIndex = (END_TIME + 1) * Math.floor(60 / SMALLEST_MIN) - j * Math.floor(60 / SMALLEST_MIN) - k;
                        cell.addEventListener("mousedown", (event) => this.selector.mousedown(event));
                        cell.addEventListener("mouseup", (event) => this.selector.mouseup(event));
                        cell.addEventListener("mouseenter", (event) => this.selector.mousehover(event));
                        cell.addEventListener("mousemove", (event) => this.selector.mousemove(event));
                        cell.addEventListener("dragover", (event) => this.dragSelector.dragover(event));  // drop可能にする
                        cell.addEventListener("dragleave", (event) => this.dragSelector.dragleave(event));  // drop可能にする
                        cell.addEventListener("drop", (event) => this.dragSelector.drop(event));  // drop可能にする
                        timeline_row.appendChild(cell);
                    }
                }
                timeline_rows.appendChild(timeline_row);
            }
            timeline_main.appendChild(timeline_rows);
        }

        reflectReservationButton(id){
            document.getElementById("reserve").style.display = "none";
            document.getElementById("change").style.display = "none";
            document.getElementById("delete").style.display = "none";
            document.getElementById("cancel").style.display = "none";
            if(id == -1){
                document.getElementById("reserve").style.display = "inline";
                document.getElementById("form_container").classList.remove("editing");
            }else{
                document.getElementById("change").style.display = "inline";
                document.getElementById("delete").style.display = "inline";
                document.getElementById("cancel").style.display = "inline";
                document.getElementById("form_container").classList.add("editing");
            }
        }

        // 左ペーンのクリックイベント
        initializeLeftPane(){
            const groups = document.getElementsByClassName("group");
            for(let i = 0; i < groups.length; i++){
                const group = groups[i];
                group.addEventListener("click", (e) => {
                    this.controller.switchGroup(e.currentTarget.dataset.group);
                    this.model.setLastOpenedGroup(e.currentTarget.dataset.group);
                });
            }
        }

        // 右ペーンの変更をmodelに伝えるlistenerなどを設定
        // model.events: {eventId: , row: 行の名前, row0の予定0のstart: , row0の予定0のend: , others: {}}
        initializeRightPane(){
            const self = this;
            const fe = document.forms.reservationForm.elements;

            fe.reserve.addEventListener("click", (e) => {
                this.controller.saveEvent();
            })
            fe.change.addEventListener("click", (e) => {
                this.controller.saveEvent();
            })
            fe.delete.addEventListener("click", (e) => {
                this.controller.deleteEvent();
            })
            
            fe.cancel.addEventListener("click", (e) => {
                this.controller.unselectEvent();
            });

            // 変更の監視
            const pulldown = document.getElementById("rows_pulldown");
            pulldown.addEventListener("change", (e) => {
                self.model.setReservationRow(e.currentTarget.options[e.target.selectedIndex].value);
            });

            fe.from_ymd.addEventListener("input", (e) => {
                this.controller.setReservationDateController(e.currentTarget.value, null)
            });
            fe.from_time.addEventListener("input", (e) => {
                this.controller.setReservationTimeController(e.currentTarget.value, null)
            });
            fe.to_ymd.addEventListener("input", (e) => {
                this.controller.setReservationDateController(null, e.currentTarget.value)
            });
            fe.to_time.addEventListener("input", (e) => {
                this.controller.setReservationTimeController(null, e.currentTarget.value)
            });

            // 名前など必須項目の入力がなかったら、予約ボタンを無効
            // その他値を再設定して、modelに渡すなど(setterはUIからの入力を拾わない)。
            const formText = Utility.getElementsByInputType("text", PASS_WORD);
            for(let i = 0; i < formText.length; i++) {
                formText[i].addEventListener("input", (event) => {
                    this.model.setReservationTextContent(event.currentTarget.name, event.currentTarget.value);
                })
            }
        }
    }
    // 選択機能用
    class Selector{
        constructor(view){
            this.view = view
            this.selecting = -1;   // 選択中でなければ-1, 選択中ならセル番号(そのrow中で)
            this.rowNum = -1; // どの行の項目が選択されているか。選択されていなければ-1, 選択されているなら、選択されている行の要素
        }
        // 選択イベントの設定
        mousedown(event){
            if(!event.target.classList.contains("timeline_cell")){
                return;
            }
            event.preventDefault();
            this.view.removeSelection(false, true);
            // すべてのセルの中で何番目か
            this.selecting = this.getSelectedCellNumber(event);
            // 現在の予約項目が何番目か
            this.rowNum = this.getSelectedRowNumber(event);

            this.view.selector_rend(this.rowNum, this.selecting, this.selecting);
            
            // hoverとdownのタイミングで右ペインに反映
            let from = this.selecting;
            let to = this.getSelectedCellNumber(event);
            if(from > to){
                from = to;
                to = this.selecting;
            }
            this.view.selector_reflect(this.rowNum, from, to);
        }
        mouseup(event){ // 反映はmousehoverで既にやっているから、ここでやる処理はない
            if(this.selecting >= 0){
                // 選択をリセット
                this.selecting = -1;
                this.rowNum = -1;
                this.view.mouseStalkerHide();
            }
        }
        mousehover(event){
            if(!event.target.classList.contains("timeline_cell")){
                return;
            }
            if(this.selecting >= 0){
                event.preventDefault();
                // hoverとdownのタイミングで右ペインに反映
                let from = this.selecting;
                let to = this.getSelectedCellNumber(event);
                if(from > to){
                    from = to;
                    to = this.selecting;
                }
                this.view.selector_rend(this.rowNum, from, to);
                this.view.selector_reflect(this.rowNum, from, to);
            }
        }
        mousemove(event){
            if(this.selecting >= 0){
                let from = this.selecting;
                let to = this.getSelectedCellNumber(event);
                if(from > to){
                    from = to;
                    to = this.selecting;
                }
                this.view.mouseStalkerRend(
                    event, 
                    Utility.date2hhmm(Utility.cell2time(from, this.view.model.currentDate), true), 
                    Utility.date2hhmm(Utility.cell2time(to, this.view.model.currentDate, true), true)
                );
            }
        }
        getSelectedRowNumber(event){
            // 予約項目の入った行を別日の入った行と共に内包するtimeline_rowsを取得
            let rows = event.currentTarget.parentElement.parentElement;
            // 現在の予約項目が何番目か
            return [].slice.call(document.getElementById("timeline_main").children).indexOf(rows);
        }
        getSelectedCellNumber(event){   // rows内で何番目か。全ての中ではない
            // 予約項目の入った行を別日の入った行と共に内包するtimeline_rowsを取得
            let rows = event.currentTarget.parentElement.parentElement;
            // 同じtimeline_rowsに含まれる全日程のセルをすべて取得
            let cells = rows.getElementsByClassName("timeline_cell");
            // すべてのセルの中で何番目か
            return [].slice.call(cells).indexOf(event.currentTarget);
        }
    }
    
    // ドラッグ機能用
    class DragSelector{
        constructor(view){
            this.view = view;
            this.selecting = -1;   // 選択中でなければ-1, 選択中ならセル番号(そのrow中で)
            this.rLength = -1;   // 予約項目の時間の長さをセル単位で。
            this.rowNum = -1;   // 移動先の行
            this.rowNumBackup = "";
            this.toBackup = -1;
            this.fromBackup = -1;
            this.eventId = -1;
        }
        // 選択イベントの設定
        dragstart(event){
            const cEvent = this.view.model.getEventFromId(event.currentTarget.dataset.eventId)?.[1];
            if(!cEvent){
                return;
            }
            this.rowNumBackup = this.view.model.rowsName.indexOf(cEvent.row);
            this.eventId = cEvent.eventId;
            this.toBackup = Utility.time2cell(Utility.ymdhm2date(cEvent.end), this.view.model.currentDate);
            this.fromBackup = Utility.time2cell(Utility.ymdhm2date(cEvent.start), this.view.model.currentDate)
            this.rLength = this.toBackup - this.fromBackup;
            this.view.removeSelection(false, true);
        }

        // ドロップされる側用
        dragover(event){
            event.preventDefault();
            this.selecting = this.getSelectedCellNumber(event);
            this.rowNum = this.getSelectedRowNumber(event);
        }
        dragleave(event){
            this.selecting = -1;
            this.rowNum = -1;
        }

        // ドラッグ終了
        drop(event){
            if(this.selecting >= 0){
                // 選択をリセット
                this.selecting = -1;
                this.rowNum = -1;
                this.view.model.currentEventId = -1;
                this.view.controller.moveEventItem(this.eventId);
                this.view.rendEventSelectToEventElement(this.eventId);
            }
        }
        drag(event){
            if(this.selecting >= 0){
                this.view.removeSelection(false, true);
                // hoverとdownのタイミングで右ペインに反映
                let from = this.selecting;
                let to = this.selecting + this.rLength - 1;
                this.view.selector_rend(this.rowNum, from, to);
                this.view.selector_reflect(this.rowNum, from, to);
            }else{
                this.view.selector_reflect(this.rowNumBackup, this.fromBackup, this.toBackup - 1);
                this.view.removeSelection(false, true);
            }
        }
        getSelectedRowNumber(event){
            // 予約項目の入った行を別日の入った行と共に内包するtimeline_rowsを取得
            let rows = event.currentTarget.parentElement.parentElement;
            // 現在の予約項目が何番目か
            return [].slice.call(document.getElementById("timeline_main").children).indexOf(rows);
        }
        getSelectedCellNumber(event){   // rows内で何番目か。全ての中ではない
            // 予約項目の入った行を別日の入った行と共に内包するtimeline_rowsを取得
            let rows = event.currentTarget.parentElement.parentElement;
            // 同じtimeline_rowsに含まれる全日程のセルをすべて取得
            let cells = rows.getElementsByClassName("timeline_cell");
            // すべてのセルの中で何番目か
            return [].slice.call(cells).indexOf(event.currentTarget);
        }
    }

    // MVCをまとめるだけ。
    class App {
        constructor(){
            const model = new Model();
            const controller = new Controller(model);
            const view = new View(model, controller); // model, controllerは渡すが、model.addEventListenr("loadReservation", (event) => {self.foo(event.bar)})以外の形では使用しないこと。
            controller.onload();
        }
    }
    // ロード時にオブジェクトだけ作成
    window.onload = function () {
        let app = new App();
    };
})()