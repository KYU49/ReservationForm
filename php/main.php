<?php
function sendJson($data, $status = 200) {
    http_response_code($status);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($data);
    exit;
}

function invalidRequest($message = "リクエストが不正です。", $status = 400) {
    sendJson(["Error", $message], $status);
}

function isYmdHm($value) {
    return (is_string($value) || is_int($value)) && preg_match('/\A\d{12}\z/', (string)$value) === 1;
}

function getEventId($request) {
    if (!array_key_exists("eventId", $request) || (!is_string($request["eventId"]) && !is_int($request["eventId"]))) {
        invalidRequest();
    }
    $eventId = (string)$request["eventId"];
    if ($eventId === "" || strlen($eventId) > 128 || preg_match('/[\x00-\x1F\x7F]/', $eventId) === 1) {
        invalidRequest();
    }
    return $eventId;
}

function verifyReservationPassword($provided, $stored) {
    if ($stored === "") {
        return true;
    }
    if ($provided === "") {
        return false;
    }
    if (password_verify($provided, $stored)) {
        return true;
    }

    return false;
}

function main() {
    if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
        invalidRequest("POSTで送信してください。", 405);
    }

    $request = json_decode(file_get_contents("php://input"), true);
    if (!is_array($request) || json_last_error() !== JSON_ERROR_NONE || !isset($request["type"]) || !is_string($request["type"])) {
        invalidRequest();
    }

    // DBに書き込める列はサーバー側で固定する。設定を追加する場合はここも更新する。
    $columnMap = [
        "group" => "groupName",
        "row" => "row",
        "start" => "start",
        "end" => "end",
        "name" => "name",
        "domain" => "domain",
        "contact" => "contact",
        "password" => "password",
    ];
    $otherColumns = ["name", "domain", "contact"];

        // ----------------------------------------------------------
        //
        // ここを修正
        //
        // ----------------------------------------------------------
        $mysqlInfo = "mysql:dbname=reservation;host=localhost;port=3306;charset=utf8mb4";    // Databaseの名前; ホストのIPやURL; port番号
        $userName = "php";   // ユーザー名
        $phpPassword = "password";
        $dbName = "dbname";
    try {
        $pdo = new PDO($mysqlInfo, $userName, $phpPassword, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        switch ($request["type"]) {
            case "fetch":
                if (!isYmdHm($request["start"] ?? null) || !isYmdHm($request["end"] ?? null) ||
                    !isset($request["group"]) || !is_string($request["group"])) {
                    invalidRequest();
                }
                $stmt = $pdo->prepare("SELECT * FROM `{$dbName}` WHERE start < :end AND :start < end AND groupName = :group");
                $stmt->execute([
                    ":end" => (string)$request["end"],
                    ":start" => (string)$request["start"],
                    ":group" => $request["group"],
                ]);
                $result = [];
                while ($cols = $stmt->fetch()) {
                    $others = [];
                    foreach ($otherColumns as $column) {
                        if (array_key_exists($column, $cols)) {
                            $others[$column] = $cols[$column];
                        }
                    }
                    $result[] = [
                        "eventId" => $cols["id"],
                        "group" => $cols["groupName"],
                        "row" => $cols["row"],
                        "start" => $cols["start"],
                        "end" => $cols["end"],
                        "others" => $others,
                    ];
                }
                sendJson($result);

            case "name_fetch":
                if (!isYmdHm($request["start"] ?? null) || !isset($request["name"]) || !is_string($request["name"])) {
                    invalidRequest();
                }
                $stmt = $pdo->prepare("SELECT groupName, start, `row` FROM `{$dbName}` WHERE :start < start AND :name = name ORDER BY start ASC LIMIT 50");
                $stmt->execute([
                    ":start" => (string)$request["start"],
                    ":name" => $request["name"],
                ]);
                $result = [];
                while ($cols = $stmt->fetch()) {
                    $result[] = [
                        "groupName" => $cols["groupName"],
                        "start" => $cols["start"],
                        "row" => $cols["row"],
                    ];
                }
                sendJson($result);

            case "delete":
                $eventId = getEventId($request);
                if ($eventId === "-1") {
                    invalidRequest();
                }
                $stmt = $pdo->prepare("SELECT id, password FROM `{$dbName}` WHERE id = :id LIMIT 1");
                $stmt->execute([":id" => $eventId]);
                $existing = $stmt->fetch();
                if (!$existing) {
                    sendJson(["Error", "既に予定が削除されています"], 404);
                }
                $providedPassword = $request["password"] ?? "";
                if (!is_string($providedPassword) || !verifyReservationPassword($providedPassword, (string)($existing["password"] ?? ""))) {
                    sendJson(["Error", "パスワードが違います。"], 403);
                }
                $stmt = $pdo->prepare("DELETE FROM `{$dbName}` WHERE id = :id");
                $stmt->execute([":id" => $eventId]);
                sendJson(["Success", "予定を削除しました"]);

            case "add":
                $allowedRequestKeys = ["type", "eventId", "group", "row", "start", "end", "others", "password"];
                foreach (array_keys($request) as $key) {
                    if (!is_string($key) || !in_array($key, $allowedRequestKeys, true)) {
                        invalidRequest();
                    }
                }
                $eventId = getEventId($request);
                if (
                    !isset($request["group"]) || !is_string($request["group"]) || $request["group"] === "" ||
                    !isset($request["row"]) || !is_string($request["row"]) || $request["row"] === "" ||
                    !isYmdHm($request["start"] ?? null) || !isYmdHm($request["end"] ?? null) ||
                    (int)$request["start"] >= (int)$request["end"]) {
                    invalidRequest();
                }

                $others = $request["others"] ?? [];
                if (!is_array($others)) {
                    invalidRequest();
                }
                $writeValues = [
                    "groupName" => $request["group"],
                    "row" => $request["row"],
                    "start" => (string)$request["start"],
                    "end" => (string)$request["end"],
                ];
                foreach ($others as $key => $value) {
                    if (!is_string($key) || !in_array($key, $otherColumns, true) || !is_string($value)) {
                        invalidRequest();
                    }
                    $writeValues[$columnMap[$key]] = $value;
                }

                $providedPassword = $request["password"] ?? "";
                if (!is_string($providedPassword)) {
                    invalidRequest();
                }

                if ($eventId !== "-1") {
                    // 更新対象を先に取得し、重複状況にかかわらず既存予約の認可を必ず行う。
                    $stmt = $pdo->prepare("SELECT id, password FROM `{$dbName}` WHERE id = :id LIMIT 1");
                    $stmt->execute([":id" => $eventId]);
                    $existing = $stmt->fetch();
                    if (!$existing) {
                        sendJson(["Error", "予約が見つかりません。"], 404);
                    }
                    $storedPassword = (string)($existing["password"] ?? "");
                    if (!verifyReservationPassword($providedPassword, $storedPassword)) {
                        sendJson(["Error", "パスワードが違います"], 403);
                    }
                    // 空欄なら既存値を維持。新しいパスワードが入力された場合は強いハッシュに更新する。
                    if ($providedPassword !== "") {
                        $writeValues["password"] = password_hash($providedPassword, PASSWORD_DEFAULT);
                    }
                } elseif ($providedPassword !== "") {
                    $writeValues["password"] = password_hash($providedPassword, PASSWORD_DEFAULT);
                }

                $stmt = $pdo->prepare("SELECT id FROM `{$dbName}` WHERE start < :end AND :start < end AND `row` = :row AND groupName = :group AND id <> :eventId LIMIT 1");
                $stmt->execute([
                    ":start" => $writeValues["start"],
                    ":end" => $writeValues["end"],
                    ":row" => $writeValues["row"],
                    ":group" => $writeValues["groupName"],
                    ":eventId" => $eventId,
                ]);
                if ($stmt->fetch()) {
                    sendJson(["Error", "既に予定が入っています"], 409);
                }

                // SQL列名は上記の固定マップからのみ生成する。
                $columns = array_keys($writeValues);
                $quotedColumns = array_map(static function($column) { return "`" . $column . "`"; }, $columns);
                $placeholders = array_map(static function($column) { return ":" . $column; }, $columns);
                $bindings = [];
                foreach ($writeValues as $column => $value) {
                    if (!in_array($column, array_values($columnMap), true)) {
                        invalidRequest();
                    }
                    $bindings[":" . $column] = $value;
                }

                if ($eventId === "-1") {
                    $sql = "INSERT INTO `{$dbName}` (" . implode(", ", $quotedColumns) . ") VALUES (" . implode(", ", $placeholders) . ")";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($bindings);
                    sendJson(["Success", "予約しました"]);
                }

                $assignments = array_map(static function($column) { return "`" . $column . "` = :" . $column; }, $columns);
                $bindings[":eventId"] = $eventId;
                $sql = "UPDATE `{$dbName}` SET " . implode(", ", $assignments) . " WHERE id = :eventId";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($bindings);
                sendJson(["Success", "予約を更新しました"]);

            default:
                invalidRequest("未対応のリクエストです。");
        }
    } catch (PDOException $e) {
        error_log("Reservation database error: " . $e->getMessage());
        sendJson(["Error", "サーバーでエラーが発生しました。"], 500);
    } catch (Throwable $e) {
        error_log("Reservation request error: " . $e->getMessage());
        sendJson(["Error", "サーバーでエラーが発生しました。"], 500);
    }
}

main();
?>