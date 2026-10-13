#!/usr/bin/env python3
"""
项目依赖快速安装工具

特点:
1. 支持多项目依赖安装
2. 交互式操作流程，可选择性安装
3. 支持启动Nacos服务
4. 详细的安装日志输出
5. 支持并行安装加速
6. 提供安装进度显示
"""

import os
import sys
import subprocess
import time
import json
import threading
import tempfile
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict

# 项目配置
PROJECT_DIRS = [
    {
        "name": "后端服务",
        "path": "backend",
        "install_cmd": "npm install",
        "description": "安装后端服务所需的Node.js依赖，用于支持后端API服务运行"
    },
    {
        "name": "React分页应用",
        "path": "react-pagination",
        "install_cmd": "npm install",
        "description": "安装React分页前端项目依赖，用于构建用户界面交互"
    },
    {
        "name": "ChatGPT-Next-Web",
        "path": "ChatGPT-Next-Web",
        "install_cmd": "npm install",
        "description": "安装ChatGPT-Next-Web项目依赖，支持AI聊天界面功能"
    },
    {
        "name": "教师React应用",
        "path": "teacher-react",
        "install_cmd": "npm install",
        "description": "安装教师端React应用依赖，提供教师管理界面"
    }
]

# Nacos服务配置
NACOS_CONFIG = {
    "name": "Nacos服务",
    "bin_path": "backend/config-city/nacos/bin",
    "shutdown_cmd": "sh shutdown.sh",
    "startup_cmd": "sh startup.sh -m standalone",
    "description": "启动配置中心和服务发现Nacos服务，为后端微服务提供配置管理"
}

# npm安装优化选项
NPM_INSTALL_OPTIONS = [
    {"name": "标准安装", "cmd_suffix": "", "description": "常规npm install，完整安装所有依赖"},
    {"name": "快速安装", "cmd_suffix": " --no-audit --no-fund", "description": "跳过安全审计和资助信息，加快安装速度"},
    {"name": "最小安装", "cmd_suffix": " --production --no-audit --no-fund", "description": "仅安装生产环境必要依赖，速度最快"}
]

# 进度相关常量
PROGRESS_UNKNOWN = -1
PROGRESS_PENDING = 0
PROGRESS_COMPLETE = 100

# npm安装阶段和对应的进度百分比
NPM_STAGES = {
    "networking": 10,
    "idealTree": 20,
    "reify": 40,
    "extract": 60,
    "build": 70,
    "audit": 80,
    "added": 90,
    "packages from": 95,
    "packages in": 95,
    "found 0 vulnerabilities": 100
}

# 全局进度字典
progress_data = {}
progress_lock = threading.Lock()

def find_project_root():
    """查找项目根目录（当前工作目录）"""
    return os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

def update_progress(project_name, status, progress, start_time=None, current_stage=None):
    """更新项目安装进度信息"""
    with progress_lock:
        if project_name not in progress_data:
            progress_data[project_name] = {
                "status": status,
                "progress": progress,
                "start_time": start_time if start_time else time.time(),
                "current_stage": current_stage if current_stage else "未知"
            }
        else:
            progress_data[project_name]["status"] = status
            progress_data[project_name]["progress"] = progress
            if current_stage:
                progress_data[project_name]["current_stage"] = current_stage

def run_command(command, cwd=None, shell=True):
    """
    执行命令并实时输出结果
    
    Args:
        command: 要执行的命令
        cwd: 执行命令的目录
        shell: 是否使用shell执行
    
    Returns:
        bool: 命令是否成功执行
    """
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            shell=shell,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        print(f"\n正在执行: {command}\n{'-' * 50}")
        
        # 实时输出命令结果
        for line in process.stdout:
            print(line.rstrip())
        
        # 等待命令执行完成
        return_code = process.wait()
        
        if return_code == 0:
            print(f"\n命令执行成功! √\n{'-' * 50}")
            return True
        else:
            print(f"\n命令执行失败，返回码: {return_code} ×\n{'-' * 50}")
            return False
            
    except Exception as e:
        print(f"\n执行命令时出错: {str(e)} ×\n{'-' * 50}")
        return False

def run_npm_install(project_info, project_root, install_option):
    """
    执行npm install并跟踪进度
    
    Args:
        project_info: 项目信息
        project_root: 项目根目录
        install_option: 安装选项
        
    Returns:
        tuple: (项目名称, 是否成功, 耗时, 输出)
    """
    project_path = os.path.join(project_root, project_info["path"])
    project_name = project_info["name"]
    
    if not os.path.exists(project_path):
        update_progress(project_name, "错误: 项目路径不存在", PROGRESS_UNKNOWN, time.time(), "失败")
        return project_name, False, 0, ["路径不存在"]
    
    # 初始化进度
    start_time = time.time()
    update_progress(project_name, "正在准备安装...", 0, start_time, "准备中")
    
    # 构建npm命令
    install_cmd = project_info["install_cmd"] + install_option["cmd_suffix"]
    
    try:
        # 启动安装进程
        process = subprocess.Popen(
            install_cmd,
            cwd=project_path,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        update_progress(project_name, "正在安装...", 5, start_time, "开始安装")
        
        output_lines = []
        
        # 读取输出并更新进度
        for line in process.stdout:
            line = line.rstrip()
            output_lines.append(line)
            
            # 解析npm输出以更新进度
            for stage, percentage in NPM_STAGES.items():
                if stage in line.lower():
                    update_progress(project_name, f"正在执行: {stage}", percentage, start_time, stage)
                    break
            
            # 检测错误
            if "err" in line.lower() or "error" in line.lower():
                if "warn" not in line.lower():  # 不要将警告当作错误
                    update_progress(project_name, f"遇到错误: {line[:50]}...", PROGRESS_UNKNOWN, start_time, "错误")
        
        # 等待命令完成
        return_code = process.wait()
        
        # 更新最终状态
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        if return_code == 0:
            update_progress(project_name, "安装成功", PROGRESS_COMPLETE, start_time, "完成")
            return project_name, True, elapsed_time, output_lines
        else:
            update_progress(project_name, f"安装失败 (返回码: {return_code})", PROGRESS_UNKNOWN, start_time, "失败")
            return project_name, False, elapsed_time, output_lines
            
    except Exception as e:
        error_msg = str(e)
        update_progress(project_name, f"错误: {error_msg}", PROGRESS_UNKNOWN, start_time, "错误")
        end_time = time.time()
        elapsed_time = end_time - start_time
        return project_name, False, elapsed_time, [f"执行命令时出错: {error_msg}"]

def display_progress(stop_event):
    """
    实时显示所有项目的安装进度
    
    Args:
        stop_event: 停止事件
    """
    spinner = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']
    spin_idx = 0
    
    try:
        while not stop_event.is_set():
            # 清空当前行
            sys.stdout.write('\r' + ' ' * 100 + '\r')
            
            # 如果没有任务，显示等待消息
            with progress_lock:
                if not progress_data:
                    sys.stdout.write(f"等待安装任务... {spinner[spin_idx]}")
                    sys.stdout.flush()
                    spin_idx = (spin_idx + 1) % len(spinner)
                    time.sleep(0.1)
                    continue
            
            # 获取进度数据的快照
            with progress_lock:
                progress_snapshot = dict(progress_data)
            
            # 按项目名称排序显示
            project_names = sorted(progress_snapshot.keys())
            
            # 计算每个任务已用时间，并显示状态
            output_lines = []
            for name in project_names:
                info = progress_snapshot[name]
                elapsed = time.time() - info["start_time"]
                progress = info["progress"]
                status = info["status"]
                
                # 构建进度条
                if progress == PROGRESS_UNKNOWN:
                    progress_bar = "[失败]"
                elif progress == PROGRESS_COMPLETE:
                    progress_bar = "[完成]"
                else:
                    bar_width = 25
                    filled_width = int(round(bar_width * progress / 100))
                    bar = '█' * filled_width + '░' * (bar_width - filled_width)
                    progress_bar = f"[{bar}] {progress}%"
                
                output_lines.append(f"{name}: {progress_bar} {status} (已用时间: {elapsed:.1f}秒)")
            
            # 打印所有项目的进度
            print("\n".join(output_lines))
            
            # 等待一段时间
            time.sleep(0.2)
            
            # 将光标移回开头
            if output_lines:
                for _ in range(len(output_lines)):
                    sys.stdout.write('\033[F')
            
    except Exception as e:
        print(f"\n显示进度时出错: {str(e)}")

def install_project_dependency(project_info, project_root):
    """
    安装单个项目依赖（顺序安装模式）
    
    Args:
        project_info: 项目信息字典
        project_root: 项目根目录
    
    Returns:
        bool: 是否安装成功
    """
    project_path = os.path.join(project_root, project_info["path"])
    
    if not os.path.exists(project_path):
        print(f"错误: 项目路径不存在 - {project_path}")
        return False
    
    print(f"\n{'=' * 60}")
    print(f"准备安装: {project_info['name']}")
    print(f"路径: {project_path}")
    print(f"说明: {project_info['description']}")
    print(f"{'=' * 60}")
    
    choice = input("是否安装此项目依赖? (y/n): ").strip().lower()
    if choice != 'y':
        print(f"跳过 {project_info['name']} 的依赖安装")
        return False
    
    # 安装依赖
    print(f"\n开始安装 {project_info['name']} 的依赖...")
    success = run_command(project_info["install_cmd"], cwd=project_path)
    
    if success:
        print(f"\n{project_info['name']} 依赖安装成功！")
    else:
        print(f"\n{project_info['name']} 依赖安装失败！")
    
    return success

def parallel_install_dependencies(projects_to_install, project_root):
    """
    并行安装多个项目依赖（使用线程而非进程）
    
    Args:
        projects_to_install: 要安装的项目列表
        project_root: 项目根目录
        
    Returns:
        dict: 安装结果
    """
    if not projects_to_install:
        return {"success": 0, "failed": 0}
    
    # 选择安装选项
    print("\n请选择安装模式:")
    for i, option in enumerate(NPM_INSTALL_OPTIONS, 1):
        print(f"{i}. {option['name']} - {option['description']}")
    
    while True:
        try:
            choice = int(input("\n请输入选项编号(默认1): ").strip() or "1")
            if 1 <= choice <= len(NPM_INSTALL_OPTIONS):
                install_option = NPM_INSTALL_OPTIONS[choice-1]
                break
            else:
                print(f"请输入1-{len(NPM_INSTALL_OPTIONS)}之间的数字")
        except ValueError:
            print("请输入有效的数字")
    
    print(f"\n已选择: {install_option['name']}")
    
    # 确认并行安装
    print(f"\n将同时安装以下 {len(projects_to_install)} 个项目:")
    for project in projects_to_install:
        print(f"- {project['name']}")
    
    # 最大并行线程数（应小于等于项目数）
    max_workers = min(len(projects_to_install), 10)  # 限制最大线程数
    print(f"\n将使用 {max_workers} 个并行线程进行安装")
    
    # 清空进度数据
    with progress_lock:
        progress_data.clear()
    
    # 创建停止事件
    stop_event = threading.Event()
    
    # 启动进度显示线程
    progress_display_thread = threading.Thread(
        target=display_progress, 
        args=(stop_event,)
    )
    progress_display_thread.daemon = True
    progress_display_thread.start()
    
    # 开始计时
    start_time = time.time()
    
    print(f"\n{'=' * 60}")
    print("正在并行安装项目依赖，进度将实时显示...")
    print(f"{'=' * 60}\n")
    
    # 为了显示进度条留出空间
    for _ in range(len(projects_to_install) + 2):
        print("")
    
    try:
        # 使用线程池并行安装（使用线程而非进程确保进度可以共享）
        results = []
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务
            futures = [
                executor.submit(
                    run_npm_install, 
                    project, 
                    project_root, 
                    install_option
                ) 
                for project in projects_to_install
            ]
            
            # 等待所有任务完成
            for future in futures:
                results.append(future.result())
        
        # 停止进度显示线程
        stop_event.set()
        progress_display_thread.join()
        
        # 清空进度显示的空行
        print("\n\n")
        
        # 汇总安装结果
        success_count = 0
        failed_count = 0
        
        print(f"\n{'=' * 60}")
        print("安装结果:")
        
        for project_name, success, install_time, _ in results:
            status = "成功 ✓" if success else "失败 ✗"
            print(f"- {project_name}: {status} (耗时: {install_time:.2f}秒)")
            
            if success:
                success_count += 1
            else:
                failed_count += 1
        
        # 计算总耗时
        total_time = time.time() - start_time
        print(f"\n并行安装完成! 总耗时: {total_time:.2f}秒")
        
        return {"success": success_count, "failed": failed_count}
    
    except Exception as e:
        # 确保停止进度显示线程
        stop_event.set()
        if progress_display_thread.is_alive():
            progress_display_thread.join()
        
        print(f"\n安装过程发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": 0, "failed": len(projects_to_install)}

def manage_nacos_service(project_root):
    """
    管理Nacos服务（关闭并重启）
    
    Args:
        project_root: 项目根目录
    
    Returns:
        bool: 是否成功
    """
    nacos_bin_path = os.path.join(project_root, NACOS_CONFIG["bin_path"])
    
    if not os.path.exists(nacos_bin_path):
        print(f"错误: Nacos bin路径不存在 - {nacos_bin_path}")
        return False
    
    print(f"\n{'=' * 60}")
    print(f"准备管理: {NACOS_CONFIG['name']}")
    print(f"路径: {nacos_bin_path}")
    print(f"说明: {NACOS_CONFIG['description']}")
    print(f"{'=' * 60}")
    
    choice = input("是否重启Nacos服务? (y/n): ").strip().lower()
    if choice != 'y':
        print(f"跳过 {NACOS_CONFIG['name']} 的管理")
        return False
    
    # 关闭Nacos服务
    print(f"\n正在关闭 {NACOS_CONFIG['name']}...")
    run_command(NACOS_CONFIG["shutdown_cmd"], cwd=nacos_bin_path)
    
    # 给一点时间确保服务完全关闭
    print("等待服务关闭...")
    time.sleep(2)
    
    # 启动Nacos服务
    print(f"\n正在启动 {NACOS_CONFIG['name']}...")
    success = run_command(NACOS_CONFIG["startup_cmd"], cwd=nacos_bin_path)
    
    if success:
        print(f"\n{NACOS_CONFIG['name']} 成功启动！")
    else:
        print(f"\n{NACOS_CONFIG['name']} 启动失败！")
    
    return success

def main():
    # 找到项目根目录
    project_root = find_project_root()
    
    print("=" * 60)
    print(f"项目依赖安装工具")
    print("=" * 60)
    print(f"识别到项目路径: {project_root}")
    print(f"项目名称: {os.path.basename(project_root)}")
    
    # 记录开始时间
    start_time = time.time()
    
    # 询问是否使用并行安装
    print("\n安装模式选择:")
    print("1. 并行安装 - 同时安装多个项目依赖（更快）")
    print("2. 顺序安装 - 逐个安装项目依赖（可实时查看日志）")
    
    install_mode = input("\n请选择安装模式 (1/2): ").strip()
    
    # 收集要安装的项目
    projects_to_install = []
    
    for project_info in PROJECT_DIRS:
        project_path = os.path.join(project_root, project_info["path"])
        
        if not os.path.exists(project_path):
            print(f"警告: 项目路径不存在 - {project_path}")
            continue
        
        print(f"\n{'=' * 60}")
        print(f"检测到项目: {project_info['name']}")
        print(f"路径: {project_path}")
        print(f"说明: {project_info['description']}")
        print(f"{'=' * 60}")
        
        choice = input("是否安装此项目依赖? (y/n): ").strip().lower()
        if choice == 'y':
            projects_to_install.append(project_info)
        else:
            print(f"跳过 {project_info['name']} 的依赖安装")
    
    # 检查是否有项目需要安装
    if not projects_to_install:
        print("\n没有选择任何项目进行安装。")
    else:
        # 安装项目依赖
        if install_mode == "1":
            # 并行安装
            install_results = parallel_install_dependencies(projects_to_install, project_root)
            installed_count = install_results["success"]
            failed_count = install_results["failed"]
            skipped_count = len(PROJECT_DIRS) - len(projects_to_install)
        else:
            # 顺序安装
            installed_count = 0
            failed_count = 0
            skipped_count = len(PROJECT_DIRS) - len(projects_to_install)
            
            for project_info in projects_to_install:
                if install_project_dependency(project_info, project_root):
                    installed_count += 1
                else:
                    failed_count += 1
    
    # 管理Nacos服务
    nacos_result = manage_nacos_service(project_root)
    
    # 记录结束时间
    end_time = time.time()
    elapsed_time = end_time - start_time
    
    # 打印安装摘要
    print("\n" + "=" * 60)
    print("安装过程摘要:")
    print(f"- 安装模式: {'并行安装' if install_mode == '1' else '顺序安装'}")
    print(f"- 已成功安装: {installed_count} 个项目")
    print(f"- 已跳过安装: {skipped_count} 个项目")
    print(f"- 安装失败: {failed_count} 个项目")
    print(f"- Nacos服务: {'已重启' if nacos_result else '未重启'}")
    print(f"- 总耗时: {elapsed_time:.2f} 秒")
    print("=" * 60)
    
    print("\n安装过程已完成！")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n操作被用户中断，程序退出")
        sys.exit(1) 