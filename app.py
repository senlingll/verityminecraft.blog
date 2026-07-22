import json
import os
import socket

from flask import Flask, render_template, request
from flask_babel import Babel
from flask_cors import CORS
from flask_frozen import Freezer

# Verity Minecraft download site

app = Flask(__name__)
babel = Babel(app)
freezer = Freezer(app)
# 允许跨域请求
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.config['FREEZER_DESTINATION'] = 'build'

# 支持的语言
SUPPORTED_LANGUAGES = ['en', 'es', 'ja', 'fr', 'de', 'pt', 'ko', 'it']
DEFAULT_LANGUAGE = 'en'

# 网站基础URL（生产环境中应该是实际域名）
BASE_URL = 'https://verityminecraft.blog'


# No protected pages since login is removed


def get_available_languages():
    """
    获取站点当前可用的语言列表

    :return: list[str]，存在公共语言文件的语言代码列表
    """
    available_langs = []
    for lang in SUPPORTED_LANGUAGES:
        common_file = os.path.join('templates', 'i18n', 'common', f'{lang}.json')
        if os.path.exists(common_file):
            available_langs.append(lang)
    return available_langs


def get_page_available_languages(page_name):
    """
    获取指定页面当前可用的语言列表

    :param page_name: 页面名称，对应 templates/i18n/pages 下的目录名
    :return: list[str]，存在该页面语言文件的语言代码列表
    """
    available_langs = []
    for lang in SUPPORTED_LANGUAGES:
        page_file = os.path.join('templates', 'i18n', 'pages', page_name, f'{lang}.json')
        if os.path.exists(page_file):
            available_langs.append(lang)
    return available_langs


def generate_canonical_url(path, lang, page_name):
    """
    生成指向实际可用语言版本的 canonical URL

    :param path: 当前请求路径
    :param lang: 当前语言代码
    :param page_name: 页面名称，用于检查页面语言文件
    :return: str，完整 canonical URL
    """
    # 清理路径，移除现有的语言前缀
    clean_path = path
    for supported_lang in SUPPORTED_LANGUAGES:
        if clean_path.startswith(f'/{supported_lang}/'):
            clean_path = clean_path[len(supported_lang) + 2:]
            break

    # 确保路径以'/'开头
    if clean_path and not clean_path.startswith('/'):
        clean_path = '/' + clean_path

    # 检查当前语言的页面是否存在
    page_available_langs = get_page_available_languages(page_name)

    # 如果当前语言的页面不存在，使用默认语言
    if lang not in page_available_langs:
        lang = DEFAULT_LANGUAGE

    if lang == DEFAULT_LANGUAGE:
        # 默认语言不需要语言前缀
        canonical_path = clean_path if clean_path != '/' else ''
    else:
        # 非默认语言添加语言前缀
        if clean_path == '/' or clean_path == '':
            canonical_path = f'/{lang}'
        else:
            canonical_path = f'/{lang}{clean_path}'

    # 确保URL以'/'结尾
    if not canonical_path.endswith('/'):
        canonical_path += '/'

    return f"{BASE_URL}{canonical_path}"


def generate_alternate_urls(page_name, current_path):
    """
    生成当前页面所有可用语言的 alternate URL

    :param page_name: 页面名称，用于检查页面语言文件
    :param current_path: 当前请求路径
    :return: dict[str, str]，hreflang 代码到完整 URL 的映射
    """
    available_langs = get_page_available_languages(page_name)
    if not available_langs:
        available_langs = [DEFAULT_LANGUAGE]
    alternate_urls = {}

    # 清理路径，移除现有的语言前缀
    clean_path = current_path
    for lang in SUPPORTED_LANGUAGES:
        if clean_path.startswith(f'/{lang}/'):
            clean_path = clean_path[len(lang) + 1:]
            break

    # 确保路径以'/'开头
    if clean_path and not clean_path.startswith('/'):
        clean_path = '/' + clean_path

    # 添加 x-default 标签（指向默认语言）
    default_path = clean_path if clean_path != '/' else ''
    if not default_path.endswith('/'):
        default_path += '/'
    alternate_urls['x-default'] = f"{BASE_URL}{default_path}"

    # 按字母顺序排序语言代码，确保一致性和可读性
    sorted_langs = sorted(available_langs)

    for lang in sorted_langs:
        if lang == DEFAULT_LANGUAGE:
            # 默认语言不需要语言前缀
            alt_path = clean_path if clean_path != '/' else ''
        else:
            # 非默认语言添加语言前缀
            if clean_path == '/' or clean_path == '':
                alt_path = f'/{lang}'
            else:
                alt_path = f'/{lang}{clean_path}'

        # 确保URL以'/'结尾
        if not alt_path.endswith('/'):
            alt_path += '/'

        alternate_urls[lang] = f"{BASE_URL}{alt_path}"

    return alternate_urls


def load_common_data(lang=DEFAULT_LANGUAGE):
    """
    加载指定语言的通用站点数据

    :param lang: 语言代码，默认使用英文
    :return: dict，导航、页眉、页脚等公共数据
    """
    common_file = os.path.join('templates', 'i18n', 'common', f'{lang}.json')
    try:
        with open(common_file, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except FileNotFoundError:
        # 如果指定语言不存在，fallback 到默认语言
        if lang != DEFAULT_LANGUAGE:
            return load_common_data(DEFAULT_LANGUAGE)
        return {}


def load_page_data(page_name, lang=DEFAULT_LANGUAGE):
    """
    加载指定页面和语言的数据

    :param page_name: 页面名称，对应页面数据目录
    :param lang: 语言代码，默认使用英文
    :return: dict，页面内容和 SEO 数据
    """
    page_file = os.path.join('templates', 'i18n', 'pages', page_name, f'{lang}.json')
    try:
        with open(page_file, 'r', encoding='utf-8-sig') as f:
            return json.load(f)
    except FileNotFoundError:
        # 如果指定语言的页面文件不存在，fallback 到默认语言
        if lang != DEFAULT_LANGUAGE:
            return load_page_data(page_name, DEFAULT_LANGUAGE)
        return {}


def get_current_language():
    """
    获取当前请求使用的语言代码

    :return: str，当前语言代码，不存在时返回默认语言
    """
    # 只从 URL 路径获取
    if hasattr(request, 'view_args') and request.view_args and 'lang' in request.view_args:
        lang = request.view_args['lang']
        if lang in get_available_languages():
            return lang

    # 直接返回默认语言（英语）
    return DEFAULT_LANGUAGE


def update_navigation_urls(navigation, lang):
    """
    根据当前语言为导航链接补充语言前缀

    :param navigation: 导航项列表
    :param lang: 当前语言代码
    :return: list，更新后的导航项列表
    """
    if not navigation:
        return navigation

    updated_nav = []
    for item in navigation:
        new_item = item.copy()
        if 'url' in new_item and new_item['url'].startswith('/') and not new_item['url'].startswith('#'):
            if lang != DEFAULT_LANGUAGE:
                new_item['url'] = f'/{lang}{new_item["url"]}'
        updated_nav.append(new_item)
    return updated_nav


def get_language_switch_url(target_lang, current_path):
    """
    生成切换到目标语言后的 URL

    :param target_lang: 目标语言代码
    :param current_path: 当前请求路径
    :return: str，切换语言后的路径
    """
    if target_lang == DEFAULT_LANGUAGE:
        # 切换到默认语言，移除语言前缀
        for lang in SUPPORTED_LANGUAGES:
            if lang != DEFAULT_LANGUAGE and current_path.startswith(f'/{lang}'):
                return current_path[len(lang) + 1:] or '/'
        return current_path
    else:
        # 切换到非默认语言，添加语言前缀
        for lang in SUPPORTED_LANGUAGES:
            if lang != DEFAULT_LANGUAGE and current_path.startswith(f'/{lang}'):
                # 当前是其他非默认语言，切换到目标语言
                return f'/{target_lang}{current_path[len(lang) + 1:]}'
        # 当前是默认语言，添加语言前缀
        return f'/{target_lang}{current_path}'


def prepare_template_data(lang, page_data, common_data, navigation, page_name):
    """
    准备页面模板渲染所需的公共上下文数据

    :param lang: 当前语言代码
    :param page_data: 当前页面数据
    :param common_data: 公共站点数据
    :param navigation: 导航项列表
    :param page_name: 页面名称
    :return: dict，模板渲染上下文字典
    """
    # 获取当前页面可用的语言
    page_available_languages = get_page_available_languages(page_name)

    # 生成语言切换URLs（只包含当前页面支持的语言）
    language_urls = {}
    for available_lang in page_available_languages:
        if available_lang != lang:
            language_urls[available_lang] = get_language_switch_url(available_lang, request.path)

    # 生成canonical URL
    canonical_url = generate_canonical_url(request.path, lang, page_name)

    # 生成alternate URLs
    alternate_urls = generate_alternate_urls(page_name, request.path)

    # No protected pages since login is removed
    is_protected = False

    return {
        'page': page_data,
        'common': common_data,
        'navigation': navigation,
        'current_lang': lang,
        'available_languages': get_available_languages(),
        'page_available_languages': page_available_languages,
        'language_urls': language_urls,
        'canonical_url': canonical_url,
        'alternate_urls': alternate_urls,
        'is_protected_page': is_protected,
        'BASE_URL': BASE_URL
    }


# Default route
@app.route('/')
def index():
    """
    渲染默认英文首页

    :return: str，首页 HTML 响应内容
    """
    return render_index_page(DEFAULT_LANGUAGE)


@app.route('/<lang>/', strict_slashes=False)
def localized_index(lang):
    """
    渲染指定语言的首页

    :param lang: 语言代码
    :return: str，指定语言首页 HTML 响应内容
    """
    if lang not in get_available_languages():
        lang = DEFAULT_LANGUAGE
    return render_index_page(lang)


def render_index_page(lang):
    """
    按语言渲染首页模板

    :param lang: 语言代码
    :return: str，首页 HTML 响应内容
    """
    common_data = load_common_data(lang)
    page_data = load_page_data('index', lang)
    navigation = []

    template_data = prepare_template_data(lang, page_data, common_data, navigation, 'index')
    return render_template('index.html', **template_data)


def render_core_page(page_name, template_name='download-page.html', lang=DEFAULT_LANGUAGE):
    """
    按语言渲染 Verity Minecraft 核心页面

    :param page_name: 页面数据目录名称
    :param template_name: 用于渲染的模板文件名
    :param lang: 语言代码
    :return: str，核心页面 HTML 响应内容
    """
    if lang not in get_page_available_languages(page_name):
        lang = DEFAULT_LANGUAGE
    common_data = load_common_data(lang)
    page_data = load_page_data(page_name, lang)
    navigation = []

    template_data = prepare_template_data(lang, page_data, common_data, navigation, page_name)
    return render_template(template_name, **template_data)


@app.route('/bedrock/', strict_slashes=False)
def bedrock_download():
    """
    渲染 Verity Minecraft Bedrock 下载页面

    :return: str，Bedrock 下载页面 HTML 响应内容
    """
    return render_core_page('bedrock')


@app.route('/<lang>/bedrock/', strict_slashes=False)
def localized_bedrock_download(lang):
    """
    渲染指定语言的 Bedrock 下载页面

    :param lang: 语言代码
    :return: str，Bedrock 下载页面 HTML 响应内容
    """
    return render_core_page('bedrock', lang=lang)


@app.route('/java/', strict_slashes=False)
def java_download():
    """
    渲染 Verity Minecraft Java 下载页面

    :return: str，Java 下载页面 HTML 响应内容
    """
    return render_core_page('java')


@app.route('/<lang>/java/', strict_slashes=False)
def localized_java_download(lang):
    """
    渲染指定语言的 Java 下载页面

    :param lang: 语言代码
    :return: str，Java 下载页面 HTML 响应内容
    """
    return render_core_page('java', lang=lang)


@app.route('/minecraft-pe/', strict_slashes=False)
def minecraft_pe_download():
    """
    渲染 Verity Minecraft PE 下载说明页面

    :return: str，Minecraft PE 页面 HTML 响应内容
    """
    return render_core_page('minecraft-pe')


@app.route('/<lang>/minecraft-pe/', strict_slashes=False)
def localized_minecraft_pe_download(lang):
    """
    渲染指定语言的 Minecraft PE 下载说明页面

    :param lang: 语言代码
    :return: str，Minecraft PE 页面 HTML 响应内容
    """
    return render_core_page('minecraft-pe', lang=lang)


@app.route('/how-to-install/', strict_slashes=False)
def how_to_install():
    """
    渲染 Verity Minecraft 安装教程页面

    :return: str，安装教程页面 HTML 响应内容
    """
    return render_core_page('how-to-install')


@app.route('/<lang>/how-to-install/', strict_slashes=False)
def localized_how_to_install(lang):
    """
    渲染指定语言的安装教程页面

    :param lang: 语言代码
    :return: str，安装教程页面 HTML 响应内容
    """
    return render_core_page('how-to-install', lang=lang)


@app.route('/versions/', strict_slashes=False)
def versions():
    """
    渲染 Verity Minecraft 版本与兼容性页面

    :return: str，版本页面 HTML 响应内容
    """
    return render_core_page('versions')


@app.route('/<lang>/versions/', strict_slashes=False)
def localized_versions(lang):
    """
    渲染指定语言的版本与兼容性页面

    :param lang: 语言代码
    :return: str，版本页面 HTML 响应内容
    """
    return render_core_page('versions', lang=lang)


@app.route('/privacy-policy/', strict_slashes=False)
def privacy_policy():
    """
    渲染隐私政策页面

    :return: str，隐私政策页面 HTML 响应内容
    """
    lang = DEFAULT_LANGUAGE
    common_data = load_common_data(lang)
    page_data = load_page_data('privacy-policy', lang)

    navigation = []

    template_data = {
        'page': page_data,
        'common': common_data,
        'navigation': navigation,
        'current_lang': lang,
        'canonical_url': f"{BASE_URL}/privacy-policy/",
        'alternate_urls': {
            'x-default': f"{BASE_URL}/privacy-policy/",
            lang: f"{BASE_URL}/privacy-policy/",
        },
        'is_protected_page': False,
        'BASE_URL': BASE_URL
    }

    return render_template('privacy-policy.html', **template_data)


@app.route('/terms-of-service/', strict_slashes=False)
def terms_of_service():
    """
    渲染服务条款页面

    :return: str，服务条款页面 HTML 响应内容
    """
    lang = DEFAULT_LANGUAGE
    common_data = load_common_data(lang)
    page_data = load_page_data('terms-of-service', lang)

    navigation = []

    template_data = {
        'page': page_data,
        'common': common_data,
        'navigation': navigation,
        'current_lang': lang,
        'canonical_url': f"{BASE_URL}/terms-of-service/",
        'alternate_urls': {
            'x-default': f"{BASE_URL}/terms-of-service/",
            lang: f"{BASE_URL}/terms-of-service/",
        },
        'is_protected_page': False,
        'BASE_URL': BASE_URL
    }

    return render_template('terms-of-service.html', **template_data)


@app.route('/about/', strict_slashes=False)
def about():
    """
    渲染关于我们页面

    :return: str，关于我们页面 HTML 响应内容
    """
    lang = DEFAULT_LANGUAGE
    common_data = load_common_data(lang)
    page_data = load_page_data('about', lang)

    navigation = []

    template_data = {
        'page': page_data,
        'common': common_data,
        'navigation': navigation,
        'current_lang': lang,
        'canonical_url': f"{BASE_URL}/about/",
        'alternate_urls': {
            'x-default': f"{BASE_URL}/about/",
            lang: f"{BASE_URL}/about/",
        },
        'is_protected_page': False,
        'BASE_URL': BASE_URL
    }

    return render_template('about.html', **template_data)


@app.route('/contact/', strict_slashes=False)
def contact():
    """
    渲染联系页面

    :return: str，联系页面 HTML 响应内容
    """
    lang = DEFAULT_LANGUAGE
    common_data = load_common_data(lang)
    page_data = load_page_data('contact', lang)

    navigation = []

    template_data = {
        'page': page_data,
        'common': common_data,
        'navigation': navigation,
        'current_lang': lang,
        'canonical_url': f"{BASE_URL}/contact/",
        'alternate_urls': {
            'x-default': f"{BASE_URL}/contact/",
            lang: f"{BASE_URL}/contact/",
        },
        'is_protected_page': False,
        'BASE_URL': BASE_URL
    }

    return render_template('about.html', **template_data)


@app.errorhandler(404)
def page_not_found(e):
    """
    渲染 404 错误页面

    :param e: Flask 传入的异常对象
    :return: tuple[str, int]，404 页面 HTML 和状态码
    """
    lang = get_current_language()
    common_data = load_common_data(lang)

    page_data = {
        'meta': {
            'title': f"404 - {common_data.get('error_404', {}).get('title', '')}",
            'description': common_data.get('error_404', {}).get('description', ''),
            'keywords': common_data.get('error_404', {}).get('keywords', '')
        }
    }
    error_data = common_data.get('error_404', {})

    template_data = {
        'page': page_data,
        'common': common_data,
        'current_lang': lang,
        'is_protected_page': False,
        'robots_content': 'noindex, follow',
        'page_available_languages': [lang],
        'language_urls': {},
        'BASE_URL': BASE_URL,
        'error': error_data
    }

    return render_template('404.html', **template_data), 404


def find_available_port(start_port):
    """
    从指定端口开始查找可用端口

    :param start_port: 起始端口号
    :return: int，可用于启动本地服务的端口号
    """
    port = start_port
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            result = sock.connect_ex(('127.0.0.1', port))
            if result != 0:
                return port
            port += 1


if __name__ == '__main__':
    app.run(debug=True, port=find_available_port(5001))
