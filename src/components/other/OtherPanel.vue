<script setup lang="ts">
import { siteAuthor } from '../../config/site'
import { analyticsEnabled } from '../../services/analytics'
</script>

<template>
  <main class="other-workspace">
    <h2>その他</h2>
    <nav
      class="other-nav"
      aria-label="その他の目次"
    >
      <a href="#usage-guide">使い方ガイド</a>
      <a href="#site-overview">サイト概要</a>
      <a href="#site-contact">要望・不具合</a>
      <a href="#site-disclaimer">免責事項</a>
      <a href="#site-privacy">保存・アクセス解析</a>
    </nav>

    <section
      id="usage-guide"
      aria-labelledby="usage-title"
    >
      <h3 id="usage-title">使い方ガイド</h3>
      <div class="guide-entry">
        <h4>「比較」タブ</h4>
        <p>
          HIFにおけるサポートカードごとの理想の動きをした場合の最大点を確認できます。初期表示は4凸・点数の高い順です。
        </p>
        <ul>
          <li>
            カード名・スキルカード名・Pアイテム名で検索し、レアリティ・タイプ・プランなどで絞り込めます。
          </li>
          <li>「一律の凸数で比較」は選んだ凸数、「所持状況で比較」は登録した凸数で計算します。</li>
          <li>一覧のカード名から詳細を開くと、効果・計算式・発動回数の根拠を確認できます。</li>
          <li>
            「制作者セレクト」は制作者が独断と偏見で選んだ「よく使われる」カードの絞り込みです。
          </li>
        </ul>
      </div>
      <div class="guide-entry">
        <h4>「所持状況」タブ</h4>
        <p>
          未所持・0～4凸を選び登録できます。初期値は所持・4凸です。変更は使用中のブラウザに自動保存されます。
        </p>
        <ul>
          <li>
            検索・絞り込み後のカードをまとめて変更できます。直前の1操作は元に戻せますが、再読み込みすると戻せなくなります。
          </li>
          <li>
            「エクスポート」で所持状況をJSONファイルに保存し、「インポート」で復元できます。別の端末へ移すときにも使えます。
          </li>
          <li>インポート時は一部更新・全体置換を選び、内容を確認してから反映します。</li>
        </ul>
      </div>
      <div class="guide-entry">
        <h4>「編成」タブ</h4>
        <p>
          育成プランを選び、選んだカードで組んだ編成の点数を確認できます。枠を選んでカードを押すか、ドラッグ＆ドロップで配置できます。
        </p>
        <ul>
          <li>
            育成プランの選択後、VoDa・DaVi・VoViのテンプレートを押すと、制作者指定の6枚へ一括で置き換えます。こちらは独断と偏見で選んだおススメ編成になります。
          </li>
          <li>
            初期の凸数は所持状況登録値、未所持なら4凸です。枠内で凸数を変えても所持状況登録は変わりません。
          </li>
          <li>
            カード一覧は名前順・点数順を切り替えられます。「詳細」を押すと、編成を変えずにカード詳細を確認できます。
          </li>
          <li>
            プラン変更時は、変更後のプランに対応しないカードだけが外れます。編成は1組を自動保存します。
          </li>
        </ul>
        <p class="other-note">
          編成の合計は各カードの個別最大点の合計です。6枚で同じ日程を実現できるとは限らず、カード同士の相互作用も含みません。
        </p>
      </div>
      <div class="guide-entry">
        <h4>「育成条件」サイドバー</h4>
        <p>
          比較・編成・カード詳細画面の「育成条件」タブから指定します。変更した条件は共有され、点数に即時反映されます。
        </p>
        <ul>
          <li>
            SP回数はタイプごとの最低確保回数です。日別指定もでき、指定中は最大8枠をSPとして、残りは各カードに最も有利な形に自動配分します。
          </li>
          <li>
            差し入れ・相談・おでかけ・特別指導・休むは、指定した回数ちょうどに固定します。「自動」はカードごとに最適化します。
          </li>
          <li>
            同日の行動の重複など、日程上成立しない指定は選択できず、その場合には操作した欄の下に理由が表示されます。
          </li>
          <li>
            試験の配分割合や、相談・特別指導などの1回あたりの操作数も変更できます。「指定を解除」で標準の条件（カード毎に自動最適化）へ戻せます。
          </li>
        </ul>
      </div>
    </section>

    <section
      id="site-overview"
      aria-labelledby="overview-title"
    >
      <h3 id="overview-title">サイト概要</h3>
      <p>
        学園アイドルマスターのサポートカードを確認・比較できるWebアプリケーションです。現在はHIFのみ対応しています。
      </p>
      <p>
        対象カードに最も有利な日程・条件で、そのカード自身のアビリティ・サポートイベント・Pアイテム・付属スキルカードによるステータス加算を評価します。
      </p>
      <p>
        体力・Pポイントの収支やステータス上限は考慮しません。効果の発動に必要な所持枚数などの条件は成立する前提です。
      </p>
      <p>
        SPレッスン発生率補正やレッスン中のスコアへの効果は、点数へ寄与しません。そのため、実際の育成結果やカードの総合的な強さを保証する点数ではありません。
      </p>
      <p>
        制作：<a
          :href="siteAuthor.xUrl"
          target="_blank"
          rel="noopener noreferrer"
          >{{ siteAuthor.name }} / {{ siteAuthor.xHandle }}（X）</a
        >
      </p>
    </section>

    <section
      id="site-contact"
      aria-labelledby="contact-title"
    >
      <h3 id="contact-title">要望・不具合</h3>
      <p>
        機能の要望、表示・計算の誤りは、制作者の<a
          :href="siteAuthor.xUrl"
          target="_blank"
          rel="noopener noreferrer"
          >X（{{ siteAuthor.xHandle }}）</a
        >
        DMへお寄せください。
      </p>
      <p>
        不具合の際は、カード名・凸数・育成条件・操作手順・期待する結果などを添えていただけると確認しやすくなります。スクリーンショットも役立ちます。
      </p>
      <p>すべてのご要望への対応や返信をお約束するものではありません。</p>
    </section>

    <section
      id="site-disclaimer"
      aria-labelledby="disclaimer-title"
    >
      <h3 id="disclaimer-title">免責事項</h3>
      <p>
        本サイトは個人が制作する非公式のファンツールであり、ゲームの運営・開発元とは関係ありません。本ツールに関するお問い合わせは、ゲームの運営元ではなく制作者へお願いします。
      </p>
      <p>
        掲載情報や計算結果には誤りが含まれる可能性があります。ゲームの更新によって実際の挙動と異なる場合もあります。本サイトの利用によって生じた損害について、制作者は責任を負いかねます。内容・機能は予告なく変更または提供を終了する場合があります。
      </p>
      <p>ゲームに関する名称・画像等の権利は、各権利者に帰属します。</p>
      <p class="other-copyright">©Bandai Namco Entertainment Inc.</p>
    </section>

    <section
      id="site-privacy"
      aria-labelledby="privacy-title"
    >
      <h3 id="privacy-title">保存・アクセス解析</h3>
      <p>
        所持状況と編成は使用中のブラウザに保存されます。所持状況・編成・入力した育成条件を、集計用データとして送信する機能はありません。
      </p>
      <p>
        別の端末・ブラウザでは保存内容を引き継ぎません。ブラウザのデータ削除や公開URLのドメイン変更で読み込めなくなることがあるため、所持状況はエクスポートで保存していただくと安心です。編成のファイル出力と育成条件の永続保存には対応していません。
      </p>
      <template v-if="analyticsEnabled">
        <p>
          利用状況と表示速度の把握にCloudflare Web
          Analyticsを使用しています。Cookieで利用者を識別せず、訪問数・ページ表示数・表示性能などを集計します。正確な実人数を数えるものではありません。
        </p>
        <p>
          計測のためCloudflareへ通信します。詳細は<a
            href="https://www.cloudflare.com/web-analytics/"
            target="_blank"
            rel="noopener noreferrer"
            >Cloudflare Web Analytics</a
          >と<a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
            >プライバシーポリシー</a
          >をご確認ください。
        </p>
      </template>
      <p v-else>現在、アクセス解析ツールによる集計は行っていません。</p>
    </section>
  </main>
</template>
