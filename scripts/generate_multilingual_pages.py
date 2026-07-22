import copy
import json
from pathlib import Path
from xml.sax.saxutils import escape

LOCALES = ["es", "ja", "fr", "de", "pt", "ko", "it"]
BASE = "https://verityminecraft.blog"
DATE_ISO = "2026-07-22"

COMMON = {
    "es": {
        "language": "Español", "download": "Descargar", "downloads": "Descargas", "install": "Instalar", "versions": "Versiones", "safety": "Seguridad", "faq": "Preguntas frecuentes", "site_section": "Sitio",
        "guide": "Guía", "source": "Página fuente", "view": "Ver versiones", "about": "Acerca de", "contact": "Contacto", "privacy": "Política de privacidad", "terms": "Términos de servicio",
        "footer": "Guía independiente de descarga de Verity Minecraft.", "date": "22 de julio de 2026",
        "default_title": "Descargar Verity Minecraft - Java, Bedrock y PE",
        "default_desc": "Guía para descargar Verity Minecraft en Java, Bedrock y PE con enlaces fuente, versiones, instalación y notas seguras.",
        "checked": "Última revisión", "primary": "Intención principal", "platforms": "Plataformas"
    },
    "ja": {
        "language": "日本語", "download": "ダウンロード", "downloads": "ダウンロード", "install": "インストール", "versions": "バージョン", "safety": "安全確認", "faq": "よくある質問", "site_section": "サイト",
        "guide": "ガイド", "source": "ソースページ", "view": "バージョンを見る", "about": "サイトについて", "contact": "お問い合わせ", "privacy": "プライバシーポリシー", "terms": "利用規約",
        "footer": "Verity Minecraft の独立したダウンロード案内です。", "date": "2026年7月22日",
        "default_title": "Verity Minecraft ダウンロード - Java・Bedrock・PE",
        "default_desc": "Verity Minecraft ダウンロードを Java、Bedrock、PE 向けに整理し、ソース、バージョン、導入手順を確認できます。",
        "checked": "最終確認", "primary": "主な目的", "platforms": "対応環境"
    },
    "fr": {
        "language": "Français", "download": "Télécharger", "downloads": "Téléchargements", "install": "Installer", "versions": "Versions", "safety": "Sécurité", "faq": "Questions fréquentes", "site_section": "Pages légales",
        "guide": "Guide", "source": "Page source", "view": "Voir les versions", "about": "À propos", "contact": "Nous contacter", "privacy": "Confidentialité", "terms": "Conditions d'utilisation",
        "footer": "Guide indépendant de téléchargement Verity Minecraft.", "date": "22 juillet 2026",
        "default_title": "Télécharger Verity Minecraft - Java, Bedrock et PE",
        "default_desc": "Guide pour télécharger Verity Minecraft sur Java, Bedrock et PE avec sources, versions, installation et conseils sûrs.",
        "checked": "Dernière vérification", "primary": "Intention principale", "platforms": "Plateformes"
    },
    "de": {
        "language": "Deutsch", "download": "Herunterladen", "downloads": "Downloadbereich", "install": "Installieren", "versions": "Versionen", "safety": "Sicherheit", "faq": "Häufige Fragen", "site_section": "Rechtliches",
        "guide": "Anleitung", "source": "Quellseite", "view": "Versionen ansehen", "about": "Über uns", "contact": "Kontakt", "privacy": "Datenschutz", "terms": "Nutzungsbedingungen",
        "footer": "Unabhängiger Download-Leitfaden für Verity Minecraft.", "date": "22. Juli 2026",
        "default_title": "Verity Minecraft herunterladen - Java, Bedrock und PE",
        "default_desc": "Verity Minecraft herunterladen für Java, Bedrock und PE mit Quellenlinks, Versionen, Installation und sicheren Hinweisen.",
        "checked": "Zuletzt geprüft", "primary": "Hauptabsicht", "platforms": "Plattformen"
    },
    "pt": {
        "language": "Português", "download": "Baixar", "downloads": "Área de download", "install": "Instalar", "versions": "Versões", "safety": "Segurança", "faq": "Perguntas frequentes", "site_section": "Páginas do site",
        "guide": "Guia", "source": "Página fonte", "view": "Ver versões", "about": "Sobre", "contact": "Contato", "privacy": "Política de privacidade", "terms": "Termos de serviço",
        "footer": "Guia independente de download do Verity Minecraft.", "date": "22 de julho de 2026",
        "default_title": "Baixar Verity Minecraft - Java, Bedrock e PE",
        "default_desc": "Guia para baixar Verity Minecraft em Java, Bedrock e PE com fontes verificadas, versões, instalação e segurança.",
        "checked": "Última verificação", "primary": "Intenção principal", "platforms": "Plataformas"
    },
    "ko": {
        "language": "한국어", "download": "다운로드", "downloads": "다운로드", "install": "설치", "versions": "버전", "safety": "안전 확인", "faq": "자주 묻는 질문", "site_section": "사이트",
        "guide": "가이드", "source": "출처 페이지", "view": "버전 보기", "about": "소개", "contact": "문의", "privacy": "개인정보 처리방침", "terms": "이용 약관",
        "footer": "Verity Minecraft를 위한 독립 다운로드 안내 사이트입니다.", "date": "2026년 7월 22일",
        "default_title": "Verity Minecraft 다운로드 - Java, Bedrock, PE",
        "default_desc": "Verity Minecraft 다운로드를 Java, Bedrock, PE별로 정리하고 출처, 버전, 설치, 안전 확인을 안내합니다.",
        "checked": "마지막 확인", "primary": "주요 목적", "platforms": "플랫폼"
    },
    "it": {
        "language": "Italiano", "download": "Scaricare", "downloads": "Download", "install": "Installare", "versions": "Versioni", "safety": "Sicurezza", "faq": "Domande frequenti", "site_section": "Sito",
        "guide": "Guida", "source": "Pagina fonte", "view": "Vedi versioni", "about": "Chi siamo", "contact": "Contatti", "privacy": "Informativa privacy", "terms": "Termini di servizio",
        "footer": "Guida indipendente al download di Verity Minecraft.", "date": "22 luglio 2026",
        "default_title": "Scaricare Verity Minecraft - Java, Bedrock e PE",
        "default_desc": "Guida per scaricare Verity Minecraft su Java, Bedrock e PE con fonti, versioni, installazione e note sicure.",
        "checked": "Ultimo controllo", "primary": "Intento principale", "platforms": "Piattaforme"
    },
}

LANGUAGE_NAMES = {
    "en": "English", "es": "Español", "ja": "日本語", "fr": "Français",
    "de": "Deutsch", "pt": "Português", "ko": "한국어", "it": "Italiano"
}

HOME_META = {
    "es": ("Descargar Verity Minecraft - Java, Bedrock y PE", "Guía para descargar Verity Minecraft en Java, Bedrock y PE con enlaces fuente, versiones, instalación y notas seguras.", "Descargar Verity Minecraft", "Java, Bedrock y PE", "descargar Verity Minecraft"),
    "ja": ("Verity Minecraft ダウンロード - Java・Bedrock・PE", "Verity Minecraft ダウンロードを Java、Bedrock、PE 向けに整理し、ソース、バージョン、導入手順を確認できます。", "Verity Minecraft ダウンロード", "Java・Bedrock・PE", "Verity Minecraft ダウンロード"),
    "fr": ("Télécharger Verity Minecraft - Java, Bedrock et PE", "Guide pour télécharger Verity Minecraft sur Java, Bedrock et PE avec sources, versions, installation et conseils sûrs.", "Télécharger Verity Minecraft", "Java, Bedrock et PE", "télécharger Verity Minecraft"),
    "de": ("Verity Minecraft herunterladen - Java, Bedrock und PE", "Verity Minecraft herunterladen für Java, Bedrock und PE mit Quellenlinks, Versionen, Installation und sicheren Hinweisen.", "Verity Minecraft herunterladen", "Java, Bedrock und PE", "Verity Minecraft herunterladen"),
    "pt": ("Baixar Verity Minecraft - Java, Bedrock e PE", "Guia para baixar Verity Minecraft em Java, Bedrock e PE com fontes verificadas, versões, instalação e segurança.", "Baixar Verity Minecraft", "Java, Bedrock e PE", "baixar Verity Minecraft"),
    "ko": ("Verity Minecraft 다운로드 - Java, Bedrock, PE", "Verity Minecraft 다운로드를 Java, Bedrock, PE별로 정리하고 출처, 버전, 설치, 안전 확인을 안내합니다.", "Verity Minecraft 다운로드", "Java, Bedrock, PE", "Verity Minecraft 다운로드"),
    "it": ("Scaricare Verity Minecraft - Java, Bedrock e PE", "Guida per scaricare Verity Minecraft su Java, Bedrock e PE con fonti, versioni, installazione e note sicure.", "Scaricare Verity Minecraft", "Java, Bedrock e PE", "scaricare Verity Minecraft"),
}

PAGE_META = {
    "bedrock": {
        "url": "/bedrock/", "source": "https://www.curseforge.com/minecraft-bedrock/addons/verity-bedrock-edition/download/8327253", "file": ".mcaddon",
        "es": ("Descargar Verity Minecraft Bedrock - Guía .mcaddon", "Guía para descargar Verity Minecraft Bedrock con fuente, .mcaddon, instalación, compatibilidad y preguntas.", "Descargar Verity Minecraft Bedrock", "descargar Verity Minecraft Bedrock", "Bedrock"),
        "ja": ("Verity Minecraft Bedrock ダウンロード .mcaddon", "Verity Minecraft Bedrock ダウンロードのソース、.mcaddon、導入手順、互換性、FAQを確認できます。", "Verity Minecraft Bedrock ダウンロード", "Verity Minecraft Bedrock ダウンロード", "Bedrock"),
        "fr": ("Télécharger Verity Minecraft Bedrock - .mcaddon", "Guide pour télécharger Verity Minecraft Bedrock avec source, .mcaddon, installation, compatibilité et FAQ.", "Télécharger Verity Minecraft Bedrock", "télécharger Verity Minecraft Bedrock", "Bedrock"),
        "de": ("Verity Minecraft Bedrock herunterladen - .mcaddon", "Verity Minecraft Bedrock herunterladen mit Quelle, .mcaddon, Installation, Kompatibilität und FAQ.", "Verity Minecraft Bedrock herunterladen", "Verity Minecraft Bedrock herunterladen", "Bedrock"),
        "pt": ("Baixar Verity Minecraft Bedrock - Guia .mcaddon", "Guia para baixar Verity Minecraft Bedrock com fonte, .mcaddon, instalação, compatibilidade e FAQ.", "Baixar Verity Minecraft Bedrock", "baixar Verity Minecraft Bedrock", "Bedrock"),
        "ko": ("Verity Minecraft Bedrock 다운로드 .mcaddon", "Verity Minecraft Bedrock 다운로드의 출처, .mcaddon, 설치, 호환성, FAQ를 확인하세요.", "Verity Minecraft Bedrock 다운로드", "Verity Minecraft Bedrock 다운로드", "Bedrock"),
        "it": ("Scaricare Verity Minecraft Bedrock - .mcaddon", "Guida per scaricare Verity Minecraft Bedrock con fonte, .mcaddon, installazione, compatibilità e FAQ.", "Scaricare Verity Minecraft Bedrock", "scaricare Verity Minecraft Bedrock", "Bedrock"),
    },
    "java": {
        "url": "/java/", "source": "https://www.curseforge.com/minecraft/mc-mods/verity-je/download/8461257", "file": ".jar",
        "es": ("Descargar Verity Minecraft Java - Mod Verity JE", "Guía para descargar Verity Minecraft Java con fuentes Verity JE, versión, loader, instalación y FAQ.", "Descargar Verity Minecraft Java", "descargar Verity Minecraft Java", "Java"),
        "ja": ("Verity Minecraft Java ダウンロード - Verity JE", "Verity Minecraft Java ダウンロードの Verity JE ソース、バージョン、ローダー、導入手順、FAQを確認できます。", "Verity Minecraft Java ダウンロード", "Verity Minecraft Java ダウンロード", "Java"),
        "fr": ("Télécharger Verity Minecraft Java - Mod Verity JE", "Guide pour télécharger Verity Minecraft Java avec sources Verity JE, version, loader, installation et FAQ.", "Télécharger Verity Minecraft Java", "télécharger Verity Minecraft Java", "Java"),
        "de": ("Verity Minecraft Java herunterladen - Verity JE Mod", "Verity Minecraft Java herunterladen mit Verity JE Quellen, Version, Loader, Installation und FAQ.", "Verity Minecraft Java herunterladen", "Verity Minecraft Java herunterladen", "Java"),
        "pt": ("Baixar Verity Minecraft Java - Mod Verity JE", "Guia para baixar Verity Minecraft Java com fontes Verity JE, versão, loader, instalação e FAQ.", "Baixar Verity Minecraft Java", "baixar Verity Minecraft Java", "Java"),
        "ko": ("Verity Minecraft Java 다운로드 - Verity JE", "Verity Minecraft Java 다운로드의 Verity JE 출처, 버전, 로더, 설치, FAQ를 확인하세요.", "Verity Minecraft Java 다운로드", "Verity Minecraft Java 다운로드", "Java"),
        "it": ("Scaricare Verity Minecraft Java - Mod Verity JE", "Guida per scaricare Verity Minecraft Java con fonti Verity JE, versione, loader, installazione e FAQ.", "Scaricare Verity Minecraft Java", "scaricare Verity Minecraft Java", "Java"),
    },
    "minecraft-pe": {
        "url": "/minecraft-pe/", "source": "https://play.google.com/store/apps/details?hl=en_US&id=com.verity.stalker.mobs.birchappsmcpe", "file": ".mcaddon / app",
        "es": ("Descargar Verity Mod Minecraft PE - Guía segura", "Guía para descargar Verity Mod Minecraft PE con ruta Bedrock, cautela APK, Google Play, instalación y FAQ.", "Descargar Verity Mod Minecraft PE", "descargar Verity Mod Minecraft PE", "PE"),
        "ja": ("Verity Mod Minecraft PE ダウンロード ガイド", "Verity Mod Minecraft PE ダウンロードで Bedrock、APK注意、Google Play、導入手順、FAQを確認できます。", "Verity Mod Minecraft PE ダウンロード", "Verity Mod Minecraft PE ダウンロード", "PE"),
        "fr": ("Télécharger Verity Mod Minecraft PE - Guide sûr", "Guide pour télécharger Verity Mod Minecraft PE avec Bedrock, prudence APK, Google Play, installation et FAQ.", "Télécharger Verity Mod Minecraft PE", "télécharger Verity Mod Minecraft PE", "PE"),
        "de": ("Verity Mod Minecraft PE herunterladen - Sicherer Guide", "Verity Mod Minecraft PE herunterladen mit Bedrock-Pfad, APK-Hinweis, Google Play, Installation und FAQ.", "Verity Mod Minecraft PE herunterladen", "Verity Mod Minecraft PE herunterladen", "PE"),
        "pt": ("Baixar Verity Mod Minecraft PE - Guia seguro", "Guia para baixar Verity Mod Minecraft PE com rota Bedrock, cuidado com APK, Google Play, instalação e FAQ.", "Baixar Verity Mod Minecraft PE", "baixar Verity Mod Minecraft PE", "PE"),
        "ko": ("Verity Mod Minecraft PE 다운로드 가이드", "Verity Mod Minecraft PE 다운로드에서 Bedrock 경로, APK 주의, Google Play, 설치, FAQ를 확인하세요.", "Verity Mod Minecraft PE 다운로드", "Verity Mod Minecraft PE 다운로드", "PE"),
        "it": ("Scaricare Verity Mod Minecraft PE - Guida sicura", "Guida per scaricare Verity Mod Minecraft PE con percorso Bedrock, cautela APK, Google Play, installazione e FAQ.", "Scaricare Verity Mod Minecraft PE", "scaricare Verity Mod Minecraft PE", "PE"),
    },
    "how-to-install": {
        "url": "/how-to-install/", "source": BASE + "/#downloads", "file": ".mcaddon / .jar",
        "es": ("Cómo instalar Verity Minecraft - Java, Bedrock y PE", "Aprende cómo instalar Verity Minecraft en Bedrock, Java y PE con comprobaciones de fuente y solución de problemas.", "Cómo instalar Verity Minecraft", "cómo instalar Verity Minecraft", "instalación"),
        "ja": ("Verity Minecraft インストール方法 - Java・Bedrock・PE", "Verity Minecraft インストール方法を Bedrock、Java、PE 向けに整理し、ソース確認とトラブル対策を説明します。", "Verity Minecraft インストール方法", "Verity Minecraft インストール方法", "インストール"),
        "fr": ("Comment installer Verity Minecraft - Java, Bedrock, PE", "Apprenez comment installer Verity Minecraft sur Bedrock, Java et PE avec vérification des sources et dépannage.", "Comment installer Verity Minecraft", "comment installer Verity Minecraft", "installation"),
        "de": ("Verity Minecraft installieren - Java, Bedrock und PE", "Verity Minecraft installieren auf Bedrock, Java und PE mit Quellenprüfung, Dateityp und Fehlerbehebung.", "Verity Minecraft installieren", "Verity Minecraft installieren", "Installation"),
        "pt": ("Como instalar Verity Minecraft - Java, Bedrock e PE", "Aprenda como instalar Verity Minecraft no Bedrock, Java e PE com verificação de fonte e solução de problemas.", "Como instalar Verity Minecraft", "como instalar Verity Minecraft", "instalação"),
        "ko": ("Verity Minecraft 설치 방법 - Java, Bedrock, PE", "Verity Minecraft 설치 방법을 Bedrock, Java, PE별로 정리하고 출처 확인과 문제 해결을 안내합니다.", "Verity Minecraft 설치 방법", "Verity Minecraft 설치 방법", "설치"),
        "it": ("Come installare Verity Minecraft - Java, Bedrock e PE", "Scopri come installare Verity Minecraft su Bedrock, Java e PE con controlli fonte e risoluzione problemi.", "Come installare Verity Minecraft", "come installare Verity Minecraft", "installazione"),
    },
    "versions": {
        "url": "/versions/", "source": BASE + "/#downloads", "file": "version list",
        "es": ("Versiones de Verity Minecraft - Notas de descarga", "Consulta versiones de Verity Minecraft para Bedrock, Java y PE con fuentes, compatibilidad y actualización segura.", "Versiones de Verity Minecraft", "versiones de Verity Minecraft", "versiones"),
        "ja": ("Verity Minecraft バージョン - ダウンロード情報", "Verity Minecraft バージョンを Bedrock、Java、PE 向けに比較し、ソース、互換性、更新確認を整理します。", "Verity Minecraft バージョン", "Verity Minecraft バージョン", "バージョン"),
        "fr": ("Versions de Verity Minecraft - Notes de téléchargement", "Consultez les versions de Verity Minecraft pour Bedrock, Java et PE avec sources, compatibilité et mise à jour sûre.", "Versions de Verity Minecraft", "versions de Verity Minecraft", "versions"),
        "de": ("Verity Minecraft Versionen - Download-Notizen", "Prüfe Verity Minecraft Versionen für Bedrock, Java und PE mit Quellen, Kompatibilität und sicheren Updates.", "Verity Minecraft Versionen", "Verity Minecraft Versionen", "Versionen"),
        "pt": ("Versões do Verity Minecraft - Notas de download", "Confira versões do Verity Minecraft para Bedrock, Java e PE com fontes, compatibilidade e atualização segura.", "Versões do Verity Minecraft", "versões do Verity Minecraft", "versões"),
        "ko": ("Verity Minecraft 버전 - 다운로드 정보", "Verity Minecraft 버전을 Bedrock, Java, PE별로 비교하고 출처, 호환성, 안전한 업데이트를 안내합니다.", "Verity Minecraft 버전", "Verity Minecraft 버전", "버전"),
        "it": ("Versioni di Verity Minecraft - Note download", "Controlla le versioni di Verity Minecraft per Bedrock, Java e PE con fonti, compatibilità e aggiornamenti sicuri.", "Versioni di Verity Minecraft", "versioni di Verity Minecraft", "versioni"),
    },
}


def write_json(path, data):
    """
    将字典内容写入 UTF-8 JSON 文件

    :param path: 输出文件路径
    :param data: 需要写入的字典数据
    :return: None，无返回值
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def common_file(lang):
    """
    生成指定语言的公共词条

    :param lang: 语言代码
    :return: dict，公共词条字典
    """
    c = COMMON[lang]
    return {
        "brand": {"name": "Verity Minecraft", "logo_prefix": "Verity", "logo_highlight": "Minecraft", "logo_suffix": "", "icon_alt": "Verity Minecraft logo", "home_aria": "Verity Minecraft home"},
        "seo": {"default_title": c["default_title"], "default_description": c["default_desc"], "author": "Verity Minecraft"},
        "site": {"domain": "verityminecraft.blog", "support_email": "support@verityminecraft.blog", "copyright_year": "2026"},
        "aria": {"primary_navigation": c["downloads"], "footer_navigation": c["downloads"], "support_email": "support@verityminecraft.blog", "language_selector": c["language"]},
        "common": {"english": "English"},
        "languages": LANGUAGE_NAMES,
        "schema": {
            "website": {"@context": "https://schema.org", "@type": "WebSite", "name": "Verity Minecraft", "description": c["default_desc"], "url": BASE + "/"},
            "faq": {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": c["default_title"], "acceptedAnswer": {"@type": "Answer", "text": c["default_desc"]}}
            ]}
        },
        "navigation": {"wiki": c["downloads"], "guide": c["install"], "database": c["versions"], "progression": c["safety"], "steam": c["download"], "faq": c["faq"]},
        "footer": {"description": c["footer"], "section_game": c["downloads"], "section_legal": c["site_section"], "about_us": c["about"], "contact_us": c.get("contact", "Contact"), "privacy_policy": c["privacy"], "terms_of_service": c["terms"], "copyright": c["footer"], "disclaimer": c["footer"]},
        "error_404": {"code": "404", "title": "Not found", "description": "Not found", "keywords": "404", "home_cta": c["download"]},
    }


def sentence_pack(lang, phrase, platform):
    """
    返回指定语言的长段落素材

    :param lang: 语言代码
    :param phrase: 页面主关键词短语
    :param platform: 平台或页面主题
    :return: list[str]，本地化段落列表
    """
    packs = {
        "es": [
            f"{phrase} debe empezar por la edición correcta, porque {platform} no se instala igual en todos los dispositivos. Revisa la fuente, el tipo de archivo, la versión de Minecraft y el modo de prueba antes de abrir tu mundo principal.",
            f"Una página útil para {phrase} no solo muestra un botón; también explica por qué ese botón lleva a una fuente mantenida. Comprueba CurseForge, Modrinth, Google Play o la página indicada, y evita espejos que oculten fecha, edición o extensión.",
            f"El mejor flujo es sencillo: identifica Java, Bedrock o PE, confirma el archivo esperado, descarga desde la fuente y prueba en una copia. Este orden reduce fallos y evita mezclar .jar, .mcaddon y listados móviles.",
            f"Si una fuente muestra una versión más reciente, la fuente gana sobre esta guía. La función de esta página es ordenar la decisión para que {phrase} sea seguro, claro y fácil de revisar antes de instalar.",
            f"También conviene guardar una nota con fecha, nombre del archivo, edición y enlace de origen. Si el juego falla después, esa nota permite volver atrás sin borrar todos los mods o complementos instalados."
        ],
        "ja": [
            f"{phrase} は、最初にエディションを確認することが重要です。{platform} では、ファイル形式、導入方法、ワールドでの有効化、互換性の確認が環境によって変わります。",
            f"{phrase} の案内ページは、ボタンだけでなく、なぜそのソースを開くのかも説明する必要があります。CurseForge、Modrinth、Google Play などの管理されたページを確認してください。",
            f"安全な手順は、Java、Bedrock、PE を選び、期待されるファイルを確認し、ソースページから入手し、コピーしたワールドや新しいプロファイルで試すことです。",
            f"ソースページに新しいバージョンがある場合は、そちらを優先します。このページは {phrase} の判断を整理し、間違った .jar、.mcaddon、APK 風ページを避けるための案内です。",
            f"ファイル名、確認日、対応 Minecraft バージョン、入手元 URL を記録しておくと、あとで不具合が起きたときに原因を切り分けやすくなります。"
        ],
        "fr": [
            f"{phrase} doit commencer par le bon choix d'édition, car {platform} ne s'installe pas de la même manière sur chaque appareil. Vérifiez la source, le fichier, la version de Minecraft et l'environnement de test.",
            f"Une bonne page pour {phrase} ne se limite pas à un bouton. Elle explique la source maintenue, la date, le type de fichier et la raison pour laquelle les miroirs inconnus sont moins fiables.",
            f"Le parcours sûr reste simple : choisir Java, Bedrock ou PE, confirmer l'extension attendue, ouvrir la source officielle ou communautaire maintenue, puis tester dans un monde copié ou un profil propre.",
            f"Si la source affiche une version plus récente, la source passe avant ce guide. Cette page sert à rendre {phrase} clair, vérifiable et moins risqué avant l'installation.",
            f"Gardez une note avec le nom du fichier, la date, l'édition et l'URL source. En cas de problème, cette trace rend le retour arrière beaucoup plus simple."
        ],
        "de": [
            f"{phrase} beginnt mit der richtigen Edition, weil {platform} nicht auf jedem Gerät gleich installiert wird. Prüfe Quelle, Dateityp, Minecraft-Version und Testumgebung, bevor du eine Hauptwelt öffnest.",
            f"Eine hilfreiche Seite für {phrase} zeigt nicht nur einen Button. Sie erklärt die gepflegte Quelle, das Dateidatum, die Erweiterung und warum unbekannte Mirrors weniger zuverlässig sind.",
            f"Der sichere Ablauf ist klar: Java, Bedrock oder PE wählen, erwartete Datei prüfen, Quelle öffnen und zuerst in einer Kopie oder einem sauberen Profil testen.",
            f"Wenn die Quelle eine neuere Version zeigt, hat die Quelle Vorrang vor dieser Übersicht. Diese Seite ordnet {phrase}, damit .jar, .mcaddon und mobile App-Links nicht verwechselt werden.",
            f"Notiere Dateiname, Datum, Edition und Quell-URL. Bei einem Fehler kannst du dadurch gezielt zurückgehen, statt alle installierten Mods oder Add-ons zu entfernen."
        ],
        "pt": [
            f"{phrase} deve começar pela edição correta, porque {platform} não é instalado da mesma forma em todos os dispositivos. Verifique a fonte, o tipo de arquivo, a versão do Minecraft e o ambiente de teste.",
            f"Uma página útil para {phrase} não mostra apenas um botão. Ela explica a fonte mantida, a data, a extensão do arquivo e por que espelhos desconhecidos são menos confiáveis.",
            f"O fluxo seguro é simples: escolha Java, Bedrock ou PE, confirme o arquivo esperado, abra a fonte indicada e teste primeiro em um mundo copiado ou perfil limpo.",
            f"Se a fonte mostrar uma versão mais recente, a fonte deve prevalecer sobre este guia. Esta página organiza {phrase} para evitar confundir .jar, .mcaddon e links móveis.",
            f"Guarde uma nota com nome do arquivo, data, edição e URL da fonte. Se algo falhar depois, essa anotação ajuda a desfazer a mudança com menos risco."
        ],
        "ko": [
            f"{phrase} 는 먼저 에디션을 확인해야 합니다. {platform} 환경에서는 파일 형식, 설치 방식, 월드 활성화, 호환성 확인이 기기와 런처에 따라 달라질 수 있습니다.",
            f"{phrase} 안내 페이지는 버튼만 보여 주면 부족합니다. 관리되는 출처, 파일 날짜, 확장자, 알 수 없는 미러를 피해야 하는 이유를 함께 설명해야 합니다.",
            f"안전한 순서는 Java, Bedrock, PE 중 하나를 고르고, 예상 파일을 확인하고, 출처 페이지에서 열고, 복사한 월드나 깨끗한 프로필에서 먼저 시험하는 것입니다.",
            f"출처 페이지에 더 새로운 버전이 있으면 그 출처를 우선합니다. 이 페이지는 {phrase} 경로를 정리해 .jar, .mcaddon, 모바일 앱 링크를 혼동하지 않게 돕습니다.",
            f"파일 이름, 확인 날짜, Minecraft 버전, 출처 URL을 적어 두면 나중에 오류가 생겼을 때 모든 모드나 애드온을 지우지 않고 원인을 좁힐 수 있습니다."
        ],
        "it": [
            f"{phrase} deve partire dalla scelta dell'edizione corretta, perché {platform} non si installa allo stesso modo su ogni dispositivo. Controlla fonte, tipo di file, versione Minecraft e ambiente di prova.",
            f"Una pagina utile per {phrase} non mostra soltanto un pulsante. Spiega la fonte mantenuta, la data, l'estensione e perché i mirror sconosciuti sono meno affidabili.",
            f"Il flusso sicuro è semplice: scegli Java, Bedrock o PE, conferma il file previsto, apri la fonte indicata e prova prima in un mondo copiato o in un profilo pulito.",
            f"Se la fonte mostra una versione più recente, la fonte prevale su questa guida. Questa pagina organizza {phrase} per evitare confusione tra .jar, .mcaddon e link mobili.",
            f"Conserva una nota con nome del file, data, edizione e URL della fonte. Se qualcosa non funziona, potrai tornare indietro senza eliminare ogni mod o add-on."
        ],
    }
    return packs[lang]


def focus_pack(lang, phrase):
    """
    生成首页关键词聚焦段落

    :param lang: 语言代码
    :param phrase: 首页主关键词短语
    :return: list[str]，关键词聚焦段落列表
    """
    packs = {
        "es": [
            f"{phrase} guía fuente, {phrase} guía fuente, {phrase} guía fuente y {phrase} guía fuente resumen.",
            f"{phrase} guía de fuente, {phrase} comprobación de versión y {phrase} ruta por edición trabajan juntos para que el usuario llegue al archivo correcto sin usar espejos confusos.",
            f"Esta sección resume {phrase} fuente segura, {phrase} instalación por plataforma y {phrase} notas de compatibilidad para Java, Bedrock y PE."
        ],
        "ja": [
            f"{phrase} ガイド ソース確認、{phrase} ガイド ソース確認、{phrase} ガイド ソース確認をまとめます。",
            f"{phrase} ガイド、{phrase} ソース確認、{phrase} バージョン確認を同じ流れで整理し、Java、Bedrock、PE の間違ったファイルを避けます。",
            f"このセクションでは {phrase} 安全ルート、{phrase} プラットフォーム別手順、{phrase} 互換性メモをまとめています。"
        ],
        "fr": [
            f"{phrase} guide source, {phrase} guide source, {phrase} guide source et {phrase} guide source résumé.",
            f"{phrase} guide de source, {phrase} contrôle de version et {phrase} parcours par édition aident à rejoindre le bon fichier sans miroir confus.",
            f"Cette section réunit {phrase} source sûre, {phrase} installation par plateforme et {phrase} notes de compatibilité pour Java, Bedrock et PE."
        ],
        "de": [
            f"{phrase} Quellen Guide, {phrase} Quellen Guide, {phrase} Quellen Guide und {phrase} Quellen Guide Übersicht.",
            f"{phrase} Quellen-Guide, {phrase} Versionsprüfung und {phrase} Editionspfad helfen dabei, die richtige Datei ohne verwirrende Mirrors zu finden.",
            f"Dieser Abschnitt bündelt {phrase} sichere Quelle, {phrase} Plattform-Installation und {phrase} Kompatibilitätsnotizen für Java, Bedrock und PE."
        ],
        "pt": [
            f"{phrase} guia fonte, {phrase} guia fonte, {phrase} guia fonte e {phrase} guia fonte resumo.",
            f"{phrase} guia de fonte, {phrase} verificação de versão e {phrase} caminho por edição ajudam a chegar ao arquivo correto sem espelhos confusos.",
            f"Esta seção reúne {phrase} fonte segura, {phrase} instalação por plataforma e {phrase} notas de compatibilidade para Java, Bedrock e PE."
        ],
        "ko": [
            f"{phrase} 출처 가이드, {phrase} 출처 가이드, {phrase} 출처 가이드와 {phrase} 출처 가이드 요약을 제공합니다.",
            f"{phrase} 가이드, {phrase} 출처 확인, {phrase} 버전 확인을 한 흐름으로 정리해 Java, Bedrock, PE에서 잘못된 파일을 피하게 합니다.",
            f"이 섹션은 {phrase} 안전 경로, {phrase} 플랫폼별 설치, {phrase} 호환성 메모를 함께 정리합니다."
        ],
        "it": [
            f"{phrase} guida fonte, {phrase} guida fonte, {phrase} guida fonte e {phrase} guida fonte riepilogo.",
            f"{phrase} guida fonte, {phrase} controllo versione e {phrase} percorso per edizione aiutano a raggiungere il file corretto senza mirror confusi.",
            f"Questa sezione unisce {phrase} fonte sicura, {phrase} installazione per piattaforma e {phrase} note di compatibilità per Java, Bedrock e PE."
        ],
    }
    return packs[lang]


def make_home(lang):
    """
    生成指定语言的首页词条

    :param lang: 语言代码
    :return: dict，首页词条字典
    """
    c = COMMON[lang]
    title, desc, h1, highlight, phrase = HOME_META[lang]
    body = sentence_pack(lang, phrase, "Java, Bedrock, PE")
    return {
        "meta": {"title": title, "description": desc},
        "schema": {"@context": "https://schema.org", "@type": "WebPage", "name": h1, "url": BASE + ("/" if lang == "en" else f"/{lang}/"), "description": desc},
        "home": {
            "nav": {"downloads": c["downloads"], "compare": "Java vs Bedrock", "install": c["install"], "versions": c["versions"], "safety": c["safety"], "faq": c["faq"]},
            "actions": {"download": c["download"], "view_versions": c["view"], "install_guide": c["guide"], "source": c["source"]},
            "hero": {"eyebrow": c["source"], "title": h1, "highlight": highlight, "lede": body[0], "support": body[1], "facts": [{"label": c["primary"], "value": c["download"]}, {"label": c["platforms"], "value": "Java / Bedrock / PE"}, {"label": c["checked"], "value": c["date"]}]},
            "downloads": {"eyebrow": c["downloads"], "title": h1, "description": body[2] + " " + body[3], "status_note": "15 seconds / 15秒 / 15 segundos", "cards": download_cards(lang, c)},
            "table": {"eyebrow": c["versions"], "title": c["default_title"], "description": body[4], "headers": [c["platforms"], c["source"], c["versions"], "File", c["guide"]], "rows": [["Bedrock", "CurseForge", "ThatMob's Verity 2.1.0 / V26.30", ".mcaddon", c["download"]], ["Java", "CurseForge / Modrinth", "verity-5.7.3.jar", ".jar", c["install"]], ["PE / Mobile", "Google Play / Bedrock", "Varies", ".mcaddon / app", c["safety"]]]},
            "compare": {"eyebrow": "Java vs Bedrock", "title": f"Java vs Bedrock: {h1}", "description": body[0] + " " + body[2], "items": [{"title": "Bedrock", "text": body[1]}, {"title": "Java", "text": body[2]}, {"title": "PE", "text": body[3]}]},
            "install": {"eyebrow": c["install"], "title": f"{c['install']} Verity Minecraft", "description": body[2], "steps": step_items(lang, phrase, c)},
            "safety": {"eyebrow": c["safety"], "title": f"{phrase} {c['safety']}", "paragraphs": focus_pack(lang, phrase) * 5 + body},
            "versions": {"eyebrow": c["versions"], "title": c["versions"], "description": body[4], "links": related_links(lang, c)},
            "faq": {"eyebrow": c["faq"], "title": f"{h1} {c['faq']}", "items": faq_items(lang, phrase, c)}
        }
    }


def download_cards(lang, c):
    """
    生成首页下载卡片

    :param lang: 语言代码
    :param c: 当前语言公共词条
    :return: list[dict]，下载卡片列表
    """
    return [
        {"platform": "Bedrock", "title": "Verity Bedrock Add-on", "description": f"Bedrock .mcaddon {c['guide']}", "version": "ThatMob's Verity 2.1.0 / V26.30", "minecraft": "Bedrock add-on", "file_type": ".mcaddon", "source": "CurseForge", "status": c["source"], "url": PAGE_META["bedrock"]["source"], "page_url": "/bedrock/", "cta": f"{c['download']} Bedrock"},
        {"platform": "Java", "title": "Verity JE Mod", "description": f"Java .jar {c['guide']}", "version": "verity-5.7.3.jar", "minecraft": "1.21.1 / 1.20.1", "file_type": ".jar", "source": "CurseForge / Modrinth", "status": c["source"], "url": PAGE_META["java"]["source"], "page_url": "/java/", "cta": f"{c['download']} Java"},
        {"platform": "Minecraft PE", "title": "Verity Mod Minecraft PE", "description": f"PE / Mobile {c['safety']}", "version": "Varies", "minecraft": "Mobile Bedrock / PE", "file_type": ".mcaddon / app", "source": "Google Play / Bedrock", "status": c["safety"], "url": PAGE_META["minecraft-pe"]["source"], "page_url": "/minecraft-pe/", "cta": f"{c['download']} PE"},
    ]


def step_items(lang, phrase, c):
    """
    生成步骤列表

    :param lang: 语言代码
    :param phrase: 页面主关键词短语
    :param c: 当前语言公共词条
    :return: list[dict]，步骤词条列表
    """
    pack = sentence_pack(lang, phrase, "Verity Minecraft")
    return [{"title": f"{c['guide']} {i + 1}", "text": text} for i, text in enumerate(pack)]


def faq_items(lang, phrase, c):
    """
    生成 FAQ 列表

    :param lang: 语言代码
    :param phrase: 页面主关键词短语
    :param c: 当前语言公共词条
    :return: list[dict]，FAQ 词条列表
    """
    pack = sentence_pack(lang, phrase, "Verity Minecraft")
    return [{"question": f"{phrase} {c['faq']} {i + 1}?", "answer": text} for i, text in enumerate(pack[:4])]


def related_links(lang, c):
    """
    生成相关页面链接

    :param lang: 语言代码
    :param c: 当前语言公共词条
    :return: list[dict]，相关链接列表
    """
    return [
        {"title": "Bedrock", "url": "/bedrock/", "text": f"Bedrock .mcaddon {c['guide']}"},
        {"title": "Java", "url": "/java/", "text": f"Java .jar {c['guide']}"},
        {"title": "Minecraft PE", "url": "/minecraft-pe/", "text": f"PE / Mobile {c['safety']}"},
        {"title": c["install"], "url": "/how-to-install/", "text": c["guide"]},
        {"title": c["versions"], "url": "/versions/", "text": c["versions"]},
    ]


def make_core(page_name, lang):
    """
    生成核心页词条

    :param page_name: 页面名称
    :param lang: 语言代码
    :return: dict，核心页词条字典
    """
    c = COMMON[lang]
    meta = PAGE_META[page_name]
    title, desc, h1, phrase, platform = meta[lang]
    pack = sentence_pack(lang, phrase, platform)
    source = meta["source"]
    return {
        "meta": {"title": title, "description": desc},
        "hero": {"eyebrow": c["source"], "title": h1, "lede": pack[0], "support": pack[1]},
        "download": {"cta": f"{c['download']} {platform}", "secondary_cta": c["guide"], "url": source if source.startswith("http") else BASE + (f"/{lang}/#downloads" if lang != "en" else "/#downloads"), "note": pack[2]},
        "facts": {"title": f"{platform} {c['guide']}", "items": [{"label": c["platforms"], "value": platform}, {"label": c["versions"], "value": "verity-5.7.3.jar" if page_name == "java" else "ThatMob's Verity 2.1.0 / V26.30" if page_name == "bedrock" else "Varies"}, {"label": "File", "value": meta["file"]}, {"label": c["source"], "value": "CurseForge / Modrinth / Google Play"}, {"label": c["checked"], "value": c["date"]}]},
        "summary": {"eyebrow": c["guide"], "title": h1, "description": pack[3], "cards": [{"title": f"{phrase} {i + 1}", "text": text} for i, text in enumerate(pack[:3])]},
        "steps": {"eyebrow": c["install"], "title": f"{c['install']} {h1}", "description": pack[4], "items": step_items(lang, phrase, c)},
        "table": {"eyebrow": c["safety"], "title": f"{h1} checklist", "description": pack[0], "headers": [c["guide"], c["safety"], c["source"]], "rows": [[meta["file"], pack[1], c["source"]], [platform, pack[2], c["install"]], [c["versions"], pack[3], c["download"]]]},
        "body": {"eyebrow": c["safety"], "title": f"{phrase} {c['safety']}", "paragraphs": pack + pack[:2], "notes": [{"title": c["source"], "text": pack[0]}, {"title": c["versions"], "text": pack[1]}, {"title": c["safety"], "text": pack[2]}]},
        "related": {"eyebrow": c["downloads"], "title": c["downloads"], "description": pack[3], "links": related_links(lang, c)},
        "extra": {"eyebrow": c["guide"], "title": f"{phrase} {c['guide']}", "paragraphs": pack[:4], "cards": [{"title": f"{c['guide']} {i + 1}", "text": text} for i, text in enumerate(pack[:3])]},
        "faq": {"eyebrow": c["faq"], "title": f"{h1} {c['faq']}", "items": faq_items(lang, phrase, c)},
    }


def write_sitemap():
    """
    写入包含多语言核心页面的 sitemap

    :return: None，无返回值
    """
    page_paths = ["/", "/bedrock/", "/java/", "/minecraft-pe/", "/how-to-install/", "/versions/"]
    legal_paths = ["/about/", "/contact/", "/privacy-policy/", "/terms-of-service/"]
    entries = []
    for path in page_paths:
        entries.append((BASE + path, "1.0" if path == "/" else "0.9" if path in ["/bedrock/", "/java/"] else "0.8"))
    for lang in LOCALES:
        for path in page_paths:
            entries.append((BASE + f"/{lang}" + ("/" if path == "/" else path), "0.9" if path == "/" else "0.8"))
    for path in legal_paths:
        entries.append((BASE + path, "0.5" if path == "/about/" else "0.4"))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, priority in entries:
        xml.extend(["  <url>", f"    <loc>{escape(loc)}</loc>", f"    <lastmod>{DATE_ISO}</lastmod>", f"    <priority>{priority}</priority>", "  </url>"])
    xml.append("</urlset>")
    Path("static/sitemap.xml").write_text("\n".join(xml) + "\n", encoding="utf-8")


def write_redirects():
    """
    写入多语言页面的尾斜杠重定向

    :return: None，无返回值
    """
    paths = ["/about", "/contact", "/privacy-policy", "/terms-of-service", "/bedrock", "/java", "/minecraft-pe", "/how-to-install", "/versions"]
    lines = [f"{p} {p}/ 301" for p in paths]
    for lang in LOCALES:
        lines.append(f"/{lang} /{lang}/ 301")
        for p in paths[4:]:
            lines.append(f"/{lang}{p} /{lang}{p}/ 301")
    Path("static/_redirects").write_text("\n".join(lines) + "\n", encoding="utf-8")


for locale in LOCALES:
    write_json(Path("templates/i18n/common") / f"{locale}.json", common_file(locale))
    write_json(Path("templates/i18n/pages/index") / f"{locale}.json", make_home(locale))
    for page in PAGE_META:
        write_json(Path("templates/i18n/pages") / page / f"{locale}.json", make_core(page, locale))

write_sitemap()
write_redirects()
