import os
import shutil
import sys

from app import DEFAULT_LANGUAGE, app, get_available_languages


def ensure_dir(path):
    """
    确保指定目录存在

    :param path: 需要创建或确认存在的目录路径
    :return: None，无返回值
    """
    if not os.path.exists(path):
        os.makedirs(path)


def save_page(url, content, build_dir):
    """
    将生成的页面内容保存到构建目录

    :param url: 页面 URL 或路由路径
    :param content: 页面 HTML 内容
    :param build_dir: 构建输出目录
    :return: None，无返回值
    """
    if url.endswith('/'):
        url = url + 'index.html'
    elif not url.endswith('.html'):
        url = url + '/index.html'

    # 移除开头的斜杠
    if url.startswith('/'):
        url = url[1:]

    # 构建完整路径
    file_path = os.path.join(build_dir, url)

    # 确保目录存在
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    # 保存内容
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)


def has_parameters(rule):
    """
    检查 Flask 路由规则是否包含动态参数

    :param rule: Flask 路由规则对象
    :return: bool，包含动态参数时返回 True
    """
    return '<' in rule.rule


try:
    # 设置Flask配置
    app.config['BABEL_DEFAULT_LOCALE'] = 'en'
    app.config['SERVER_NAME'] = 'verityminecraft.blog'

    # 创建build目录
    build_dir = 'build'
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    os.makedirs(build_dir)

    # 生成页面
    with app.test_client() as client:
        # 遍历所有路由并生成页面
        for rule in app.url_map.iter_rules():
            if rule.endpoint != 'static':  # 跳过静态文件路由
                url = rule.rule
                
                # 检查是否为包含<lang>参数的路由
                if '<lang>' in url:
                    # 为每个可用语言生成URL
                    for lang in get_available_languages():
                        if lang == DEFAULT_LANGUAGE:
                            continue
                        lang_url = url.replace('<lang>', lang)
                        try:
                            response = client.get(lang_url)
                            if response.status_code == 200:
                                save_page(lang_url.lstrip('/'), response.data.decode('utf-8'), build_dir)
                                print(f"Generated: {lang_url}")
                        except Exception as e:
                            print(f"Error generating {lang_url}: {e}", file=sys.stderr)
                elif '<' not in url:  # 只处理静态路由（不含其他参数）
                    try:
                        response = client.get(url)
                        if response.status_code == 200:
                            save_page(url.lstrip('/'), response.data.decode('utf-8'), build_dir)
                            print(f"Generated: {url}")
                    except Exception as e:
                        print(f"Error generating {url}: {e}", file=sys.stderr)

    # 复制静态文件
    if os.path.exists('static'):
        shutil.copytree('static', os.path.join(build_dir, 'static'))

    # 复制其他静态文件
    for file in ['robots.txt', 'sitemap.xml', 'favicon.ico', 'llms.txt', 'llms-full.txt', 'ads.txt', '_redirects']:
        src = os.path.join('static', file)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(build_dir, file))

    # 生成404页面
    with app.test_client() as client:
        with app.test_request_context('/non-existent-page'):
            from app import page_not_found
            from werkzeug.exceptions import NotFound
            
            try:
                # 创建一个虚拟的404错误并生成页面
                error_404 = NotFound()
                response_content, status_code = page_not_found(error_404)
                save_page('404.html', response_content, build_dir)
                print("Generated: 404.html")
            except Exception as e:
                print(f"Error generating 404.html: {e}", file=sys.stderr)

    print("Static files generation completed!")
except Exception as e:
    print(f"Error during build process: {e}", file=sys.stderr)
    sys.exit(1)
