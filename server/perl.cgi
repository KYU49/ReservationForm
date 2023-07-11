#!/usr/bin/perl

#    Copyright (c) 2023 KYU @ https://github.com/KYU49
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <https://www.gnu.org/licenses/agpl-3.0.html>.

use strict;
use CGI;
use utf8;
use Data::Dumper;
use URI::Escape;
use FindBin;
# use lib "$FindBin::Bin/extlib";
use JSON;
# use Digest::SHA::PurePerl qw(sha256_base64);
use Digest::SHA qw(sha256_base64);

# curl -X POST -H "Content-Type: application/json" -d "{\"type\":\"fetch\",\"start\":202307120000,\"end\":202307130000,\"group\":\"建物A_1F\"}" "http://localhost/cgi-bin/reserv/perl.cgi"
# curl -X POST -H "Content-Type: application/json" -d "{\"type\":\"add\",\"eventId\":-1,\"row\":\"A-101\",\"group\":\"建物A_1F\",\"start\":202307131000,\"end\":202307131100,\"others\":{\"name\":\"Tarou\",\"domain\":\"GroupA\",\"contact\":\"mail.com\"}}" "http://localhost/cgi-bin/reserv/perl.cgi"
# curl -X POST -H "Content-Type: application/json" -d "{\"type\":\"delete\",\"eventId\":2}" "http://localhost/cgi-bin/reserv/perl.cgi"

# https://www.futomi.com/lecture/json.html#gsc.tab=0
my $logdir = ".";
my $password_row = 8;

# 参考: https://qiita.com/ekzemplaro/items/43dc7cd15f3333dc9285
my $q = new CGI;
print $q->header(
	-type=>"text/html",
	-http_equiv=>"Content-Type",
	-charset=>"UTF-8"
);

my $json = JSON->new->allow_nonref;
my $request = uri_unescape($q->param("POSTDATA"));
my $rj = $json->decode($request);

# 保存ファイルでは、
# 0: id, 1: group, 2: row, 3: start, 4: end, 5: name, 6: domain, 7: contactの順

if ($rj->{"type"} eq "fetch") {
    my $start = $rj->{"start"};
    my $end = $rj->{"end"};
    my $group = $rj->{"group"};

    # datからの予定取得
    my @events = ();
    my $target = -1;
    open(IN, "$logdir/reserv.dat") || die $!;
    while(<IN>){
        my @l = split(/\t/, $_);
        if($l[3] < $end && $start < $l[4] && $group eq $l[1]){  # 同じグループの指定した時間の予定だけを取得
            push @events, {"id" => $l[0], "group" => $l[1], "row" => $l[2], "start" => $l[3], "end" => $l[4], "others" => {"name" => $l[5], "domain" => $l[6], "contact" => $l[7]}};
        }
    }
    close IN;
    print $json->encode(@events);

} elsif ($rj->{"type"} eq "delete") {
    my $event_id = $rj->{"eventId"};
    my $hashed_password = "";

    if(exists $rj->{"password"}){
        $hashed_password = hasher($rj->{"password"}, 10);
    }
    # datからの予定取得
    my $results = {"Error", "既に予定が削除されています"};
    my $error_handler = 0;

    open(FD, "+<$logdir/reserv.dat") || die $!;
        # 読み込み + 添付ファイルの作成 (メモリのケア)
        while(!flock(FD, 2)){  # 別のユーザーによるflockが解除されるまでループ
            sleep(1);
        }
        open(OUT, ">$logdir/temp.dat") || die $!;
            while(<FD>){
                if($_ =~ /^$event_id\t/){   # 削除対象ならスキップ
                    my @l = split(/\t/, $_);
                    if ($hashed_password eq "" || $hashed_password eq $l[$password_row]){
                        $error_handler = 1;
                        next;
                    } else {
                        $results = {"Error", "パスワードが違います。"};
                    }
                }
                print OUT $_;
            }
        close(OUT);

        # 書き込み
        truncate(FD, 0);
        seek(FD, 0, 0);

        open(IN, "$logdir/temp.dat") || die $!;
            while(<IN>){
                chomp($_);
                if(length($_) > 0){
                    print FD $_ . "\n";
                }
            }
        close(IN);
    close(FD);

    if($error_handler){
        $results = {"Success", "予約を削除しました"};
    }
    
    print $json->encode($results);
} else {
    my $event_id = $rj->{"eventId"};
    my $start = $rj->{"start"};
    my $end = $rj->{"end"};
    my $group = $rj->{"group"};
    my $row = $rj->{"row"};
    my $others =$rj->{"others"};
    my $hashed_password = "";

    if(exists $rj->{"password"}){
        $hashed_password = hasher($rj->{"password"}, 10);
    }

    # datからの予定取得
    my $results = {"Error", "既に予約が入っています。"};
    my $error_handler = 1;
    my $target_id = 0;
    open(FD, "+<$logdir/reserv.dat") || die $!;
        # 読み込み + 添付ファイルの作成 (メモリのケア)
        while(!flock(FD, 2)){  # 別のユーザーによるflockが解除されるまでループ
            sleep(1);
        }
        open(OUT, ">$logdir/temp.dat") || die $!;
            while(<FD>){
                my @l = split(/\t/, $_);
                # IDの最大値を取得
                if($target_id <= @l[0]){
                    $target_id = @l[0] + 1;
                }
                if($l[3] < $end && $start < $l[4] && $group eq $l[1] and $event_id != $l[0]){  # 重複する予定があれば
                    $results = {"Error", "既に予約が入っています。"};
                    $error_handler = 0;
                    last;
                }
                if($l[0] == $event_id){   # 同じidの予約なら
                    if ($hashed_password eq "" || $hashed_password eq $l[$password_row]){
                        next;   # パスワードも一致しているため、この予定を編集するためにリストからスキップ
                    } else {
                        $results = {"Error", "パスワードが違います。"};
                        $error_handler = 0;
                    }
                }
                print OUT $_;
            }
        close(OUT);
        if($error_handler){ 
            if($event_id > -1){  # 編集の場合は編集予定の予定を一旦削除
                # 書き込み
                truncate(FD, 0);
                seek(FD, 0, 0);

                open(IN, "$logdir/temp.dat") || die $!;
                    while(<IN>){
                        chomp($_);
                        if(length($_) > 0){
                            print FD $_ . "\n";
                        }
                    }
                close(IN);
                $target_id = $event_id;
            }
            # 保存ファイルでは、
            # 0: id, 1: group, 2: row, 3: start, 4: end, 5: name, 6: domain, 7: contactの順
            print FD $target_id . "\t" . $group . "\t" . $row . "\t" . $start . "\t" . $end . "\t" . $others->{"name"} . "\t" . $others->{"domain"} . "\t" . $others->{"contact"} . "\n";
        }
    close(FD);

    if($error_handler){
        if($event_id > 0){
            $results = {"Success", "予約を更新しました。"};
        }else{
            $results = {"Success", "予約を追加しました。"};
        }
    }
    
    print $json->encode($results);
}

# パスワードのハッシュ化。強度を上げるために複数回実行
sub hasher{
    my ($pass, $count) = @_;
    my $hashed = sha256_base64($pass . "irohanihoheto"); # 暗号強度を高めるための適当な文字列
    if($count > 0){
        return hasher($hashed, $count - 1);
    }else{
        return $hashed;
    }
}