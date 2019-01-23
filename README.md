# Hyperledger Fabric 開発・新機能評価用テストツール

## 走らせる

    cd tests/v1.3.0/balance-transfer
    make setup_environment  // 公式の Fabric v1.3.0 関連の docker image をダウンロード
    make run_test           // 全テストケースを走らせる

## 構成

    tests/              テストコード、テストケース
      v1.2.0/           Fabric のバージョン選択
        byfn            Fabric ネットワークの構成の選択 (基本的に fabric-samples 配下を借りる)
          ...
      v1.3.0/
        byfn
        balance-transfer
          Makefile      設定・テスト開始コマンド等
          libs/         テストコード (共通部)
          cases/        テストケース関連
            ...
      devel/            開発版
        ...
    jenkins/            CI 関連

## 使用方法・動作概要

走行させた Fabric のバージョンや Fabric ネットワークの構成に応じてディレクトリ (`tests/v1.3.0/balance-transfer` など) に移動する。
`make run_test` コマンドで当該バージョン・ネットワーク構成の配下で定義されているテストケース (`cases/` 配下) を全て走行させる。
一部のテストケースだけ選択的に走行させたい場合、環境変数 `TESTCASES` で指定する。

    TESTCASES="cases/private_data_collection/simple cases/endorsement_policy/need_two_send_two/test" make run_all
    // 指定した 2 つのテストケースのみ走行させる

テストケースが正常に終了すると、Fabric ネットワークのコンテナは全て削除されて返ってくる。
デバッグ等の目的でテスト走行後もコンテナやアプリケーションを上げたままにしておきたい場合、環境変数 `DEBUG` を指定する。

    DEBUG=true TESTCASES="cases/private_data_collection/simple" make run_all

`DEBUG` を指定する場合、走行させるテストケースを一つに指定していないと、前のテストの状態が残ったまま次のテストケースを実行してしまうことになるので、注意する。

## テストコードの構造

テストケースは環境変数や任意のシェルスクリプトのコードを実行させることができるが、下記の関数は必ず定義する必要がある。

- `start_fabric_network`: Fabric ネットワークの構築処理
- `start_application`: SDK を使用する場合、API を提供するアプリケーションを起動する
- `scenario`: テストのロジック
- `stop_application`: アプリケーションの終了処理
- `stop_fabric_network`: Fabric ネットワークの削除 (コンテナの削除)

設定は基本的に `cases/` 配下のディレクトリ構造によって決められた順序にインクルードされる。
例えば、下記のような構成を考えてみる。

    cases/
      config
      section1
        config
        subsection11/
          config
          test111
          test112
      section2
        subsection21
          config
          test211

`TESTCASES` で `cases/section1/subsection1/test111` というテストケースを指定した場合、下記の順序でインクルードされた状態でテストが走行する。

- `cases/config`
- `cases/section1/config`
- `cases/section1/subsection11/config`
- `cases/section1/subsection11/test111`

`cases/section2/subsection21/test211 を指定した場合は、下記の設定が順次インクルードされる。

- `cases/config`
- `cases/section2/subsection21/config`
- `cases/section2/subsection21/test211`

これにより複数のテストケースの共通部分をくくりだしつつ動作を定義することができる。

## テストケースの追加方針

...
