<?php
    function main(){
        // jsonでのpostを取得(urldecodeは不要？)
        $request = json_decode(file_get_contents("php://input"), true);
        if(is_null($request)){
            header("Content-Type: application/json; charset=utf-8; Access-Control-Allow-Origin: *;");
            echo json_encode(["Error", "This page is not available for user."]);
            return;
        }
        $result = [];
        // keyがjson用の配列のキー, valueがmysqlのキー
        $keysConv = [
            "eventId" => "id", 
            "group" => "groupName", 
            "row" => "row", 
            "start" => "start", 
            "end" => "end"
        ];

        // ----------------------------------------------------------
        //
        // ここを修正
        //
        // ----------------------------------------------------------
        $mysqlInfo = "mysql:dbname=reservation;host=localhost;port=3333"    // Databaseの名前; ホストのIPやURL; port番号
        $userName = "php"   // ユーザー名
        $phpPassword = "password"

        // 要求に応じて処理を実施; 参考: https://qiita.com/sanogemaru/items/dd981a5ee4487cedf02f
        switch($request["type"]){
            case "fetch":
                try{
                    $pdo = new PDO (
                        $mysqlInfo,    
                        $userName,
                        $phpPassword
                    );

                    $stmt = $pdo -> prepare("SELECT * FROM `DRL3-2` WHERE start < :end AND :start < end AND :group = groupName");    // 同じグループの指定した時間の予定だけを取得
                    $stmt -> bindValue(":end", $request["end"], PDO::PARAM_STR);
                    $stmt -> bindValue(":start", $request["start"], PDO::PARAM_STR);
                    $stmt -> bindValue(":group", $request["group"], PDO::PARAM_STR);
                    $stmt -> execute();
                    while($cols = $stmt -> fetch()){
                        // default要素以外を取得
                        $defValues = [];
                        $others = [];
                        // keysConvで指定していない値をothersにまとめる
                        foreach($cols as $key => $value){
                            if(!in_array($key, array_values($keysConv), true) && !is_numeric($key) && $key != "password"){  // 特定のキー以外をまとめたい
                                $others[$key] = $value;
                            }
                        }
                        // keysConvで指定した値をまとめる
                        foreach($keysConv as $key => $value){
                            $defValues[$key] = $cols[$value];
                        }
                        $defValues["others"] = $others;
                        $result[] = $defValues;
                    }
                    $pdo = null;
                } catch (PDOException $e){
                    print "DB ERROR: " . $e->getMessage() . "</br>";
                    die();
                }
                break;
            case "delete":
                try{
                    $pdo = new PDO (
                        $mysqlInfo,    
                        $userName,
                        $phpPassword
                    );
                    $hashedPassword = "";
                    // パスワードが指定されている場合のみ、パスワード処理を判定
                    //if(in_array("password", array_keys($request), true)){
                    if(array_key_exists("password", $request)){
                        $hashedPassword = hasher($request["password"], 10);
                    }
                    $result = ["Success", "予定を削除しました"];

                    $stmt = $pdo -> prepare("SELECT * FROM `DRL3-2` WHERE id = :id LIMIT 1");    // まずは存在チェック
                    $stmt -> bindValue(":id", $request["eventId"], PDO::PARAM_STR);
                    $stmt -> execute();
                    if($cols = $stmt -> fetch()){    // 存在する場合
                        // パスワードの設定チェック
                        if($cols["password"] == "" || $hashedPassword == $cols["password"]){    // データベース上にパスワードが設定されていないか、パスワードが一致する場合は削除
                            $stmt = $pdo -> prepare("DELETE FROM `DRL3-2` WHERE id = :id");
                            $stmt -> bindValue(":id", $request["eventId"], PDO::PARAM_STR);
                            $stmt -> execute();
                        }else{
                            $result = ["Error", "パスワードが違います。"];
                        }
                    }else{
                        $result = ["Error", "既に予定が削除されています"];
                    }
                    $pdo = null;
                } catch (PDOException $e){
                    print "DB ERROR: " . $e->getMessage() . "</br>";
                    die();
                }
                break;
            default:
                try{
                    $pdo = new PDO (
                        $mysqlInfo,    
                        $userName,
                        $phpPassword
                    );
                    $hashedPassword = "";
                    // パスワードが指定されている場合のみ、パスワード処理を判定
                    if(array_key_exists("password", $request)){
                        $hashedPassword = hasher($request["password"], 10);
                    }
                    $result = ["Success"];

                    if($request["eventId"] != "-1"){
                        $result[] = "予約を更新しました";
                    }else{
                        $result[] = "予約しました";
                    }
                    // まずは重複チェック
                    $stmt = $pdo -> prepare("SELECT * FROM `DRL3-2` WHERE start < :end AND :start < end AND row = :row LIMIT 2");
                    $stmt -> bindValue(":start", $request["start"], PDO::PARAM_STR);
                    $stmt -> bindValue(":end", $request["end"], PDO::PARAM_STR);
                    $stmt -> bindValue(":row", $request["row"], PDO::PARAM_STR);
                    $stmt -> execute();

                    // 先にエラーハンドリング
                    if($stmt -> rowCount() > 1){    // 2つの予定と重複している時点で、既に変更不可
                        $result = ["Error", "既に予定が入っています"];
                        break;
                    } else {
                        if($cols = $stmt -> fetch()){   // 重複が1つだけある場合
                            if($cols["id"] != $request["eventId"]){   // 別の予定との重複の場合は変更不可, 自身との重複は可
                                $result = ["Error", "既に予定が入っています"];
                                break;
                            }else if($cols["password"] != "" && $hashedPassword != $cols["password"]){  // データベース上にパスワードが設定されていないか、パスワードが一致する場合のみ処理
                                $result = ["Error", "パスワードが違います"];
                                break;
                            }
                        }
                    }
                    
                    // othersの内容を反映するために、subQueryを設定
                    $subQueryTo = "";
                    $subQueryVal = "";
                    $keysGen = [];
                    // keysConvで指定した値、type以外をまとめる
                    foreach(array_keys($request) as $key){
                        if($key == "others"){
                            foreach(array_keys($request["others"]) as $keyOthers){
                                if(array_key_exists($keyOthers, $keysConv)){  // eventId -> idなどの変換
                                    $keysGen[$keyOthers] = $keysConv[$keyOthers];
                                }else{
                                    $keysGen[$keyOthers] = $keyOthers;
                                }
                            }
                        }else if($key != "type" && $key != "eventId"){ // idはinsertのときに不要なため、除いておく。
                            if(array_key_exists($key, $keysConv)){  // eventId -> idなどの変換
                                $keysGen[$key] = $keysConv[$key];
                            }else{
                                $keysGen[$key] = $key;
                            }
                        }
                    }

                    $stmt = NULL;
                    if($request["eventId"] == "-1"){    // insert
                        // どの変数に値を入れるか
                        foreach($keysGen as $key => $value){
                            $subQueryTo .= $value . ", ";
                            $subQueryVal .= ":" . $key . ", ";
                        }
                        $subQueryTo = substr($subQueryTo, 0, -2);
                        $subQueryVal = substr($subQueryVal, 0, -2);

                        $stmt = $pdo -> prepare("INSERT INTO `DRL3-2` (" . $subQueryTo . ") VALUES (" . $subQueryVal . ")");
                    }else{  // update
                        // どの変数に値を入れるか
                        foreach($keysGen as $key => $value){
                            $subQueryVal .= $value . " = :" . $key . ", ";
                        }
                        $subQueryVal = substr($subQueryVal, 0, -2);
                        $stmt = $pdo -> prepare("UPDATE `DRL3-2` SET " . $subQueryVal . " WHERE id =:eventId");
                        $stmt -> bindValue(":eventId", $request["eventId"], PDO::PARAM_STR);  // 更新なので、idだけセットしておく
                    }
                    // subqueryの分をbindする
                    foreach($keysGen as $key => $value){
                        if($key == "password"){
                            $stmt -> bindValue(":password", $hashedPassword, PDO::PARAM_STR);
                        }else{
                            if(array_key_exists($key, $request)){ // othersに入っている場合を想定して、request直下にあるか確認
                                $stmt -> bindValue(":" . $key, $request[$key], PDO::PARAM_STR);
                            }else{
                                if(array_key_exists($key, $request["others"])){
                                    $stmt -> bindValue(":" . $key, $request["others"][$key], PDO::PARAM_STR);
                                }
                            }
                        }
                    }
                    $stmt -> execute();
                    
                    $pdo = null;
                } catch (PDOException $e){
                    print "DB ERROR: " . $e->getMessage();
                    die();
                }
                break;
        }
        // 
        header("Content-Type: application/json; charset=utf-8; Access-Control-Allow-Origin: *;");
        echo json_encode($result);
    }

    # パスワードのハッシュ化。強度を上げるために複数回実行
    function hasher ($pass, $count){
        $hashed = hash("sha256", $pass . "irohanihoheto");
        if($count > 0){
            return hasher($hashed, $count - 1);
        }else{
            return $hashed;
        }
    }

    main();
?>