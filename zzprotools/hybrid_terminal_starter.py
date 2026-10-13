#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
混合终端启动工具 - 在Cursor内置终端运行后端，在外部终端窗口运行前端
"""

import os
import sys
import subprocess
import platform
import time
from pathlib import Path

# 获取脚本所在目录作为项目根目录
ROOT_DIR = Path(__file__).resolve().parent.parent

def print_colored(text, color_code):
    """打印彩色文本"""
    print(f"\033[{color_code}m{text}\033[0m")

def create_external_terminal(title, command):
    """在外部终端中创建并执行命令"""
    system = platform.system()
    
    print_colored(f"正在外部终端中启动: {title}", "1;32")
    
    if system == "Darwin":  # macOS
        # 为命令添加cd切换到正确目录
        full_command = f"cd '{ROOT_DIR}' && {command}"
        
        # 使用AppleScript创建新终端窗口并执行命令
        applescript = f'''
        tell application "Terminal"
            do script "{full_command}"
            set custom title of front window to "{title}"
        end tell
        '''
        subprocess.run(["osascript", "-e", applescript])
        
    elif system == "Linux":
        # 为Linux系统创建新终端 (gnome-terminal)
        subprocess.run([
            "gnome-terminal", 
            "--title", title, 
            "--", "bash", "-c", 
            f"cd '{ROOT_DIR}' && {command}; exec bash"
        ])
        
    elif system == "Windows":
        # 对于Windows，使用start cmd命令
        subprocess.run([
            "cmd.exe", "/c", "start", 
            f"cmd.exe /k title {title} ^& cd /d {ROOT_DIR} ^& {command}"
        ], shell=True)

def check_backend_directory():
    """检查后端目录是否存在"""
    backend_dir = ROOT_DIR / "backend"
    if not backend_dir.exists():
        print_colored(f"错误: 后端目录不存在: {backend_dir}", "1;31")
        return False
    
    backend_start_script = backend_dir / "start-servers.js"
    if not backend_start_script.exists():
        print_colored(f"错误: 后端启动脚本不存在: {backend_start_script}", "1;31")
        print_colored("将直接使用 server_manager.py --backend-only 启动后端", "1;33")
    
    return True

def check_frontend_directories():
    """检查前端目录是否存在，返回存在的目录名称"""
    frontend_dirs = {}
    
    # 学生端前端
    react_pagination_dir = ROOT_DIR / "react-pagination"
    frontend_dir = ROOT_DIR / "frontend"
    
    if react_pagination_dir.exists():
        frontend_dirs["student"] = "react-pagination"
    elif frontend_dir.exists():
        frontend_dirs["student"] = "frontend"
    else:
        print_colored("警告: 学生端前端目录不存在", "1;33")
    
    # 教师端前端
    teacher_dir = ROOT_DIR / "teacher-react"
    if teacher_dir.exists():
        frontend_dirs["teacher"] = "teacher-react"
    else:
        print_colored(f"警告: 教师端前端目录不存在: {teacher_dir}", "1;33")
    
    return frontend_dirs

def main():
    """主函数"""
    print_colored("混合终端启动工具", "1;35")
    print_colored("=================\n", "1;35")
    print_colored("当前项目根目录: ", "1;35")
    print(ROOT_DIR)
    
    # 1. 检查后端目录
    if not check_backend_directory():
        print_colored("错误: 无法启动后端服务器", "1;31")
        return
    
    # 2. 检查前端目录
    frontend_dirs = check_frontend_directories()
    if not frontend_dirs:
        print_colored("警告: 未找到任何前端目录", "1;33")
    
    # 3. 显示启动信息
    print_colored("\n即将启动以下服务:", "1;36")
    print_colored("• 后端服务器: 在Cursor内置终端中启动", "1;37")
    
    if "student" in frontend_dirs:
        print_colored(f"• 学生端前端: 在外部终端中启动 (目录: {frontend_dirs['student']})", "1;37")
    
    if "teacher" in frontend_dirs:
        print_colored(f"• 教师端前端: 在外部终端中启动 (目录: {frontend_dirs['teacher']})", "1;37")
    
    print_colored("\n开始启动...\n", "1;36")
    
    # 4. 启动前端（在外部终端）
    if "student" in frontend_dirs:
        create_external_terminal(
            "学生端前端",
            f"cd {frontend_dirs['student']} && npm run dev"
        )
        time.sleep(1)  # 稍微延迟，避免终端启动过快
    
    if "teacher" in frontend_dirs:
        create_external_terminal(
            "教师端前端",
            f"cd {frontend_dirs['teacher']} && npm run dev"
        )
        time.sleep(1)  # 稍微延迟
    
    # 5. 在当前终端启动后端（最后启动，保持焦点在后端）
    print_colored("\n在Cursor内置终端启动后端服务器...", "1;34")
    print_colored("后端日志将在此终端显示\n", "1;34")
    
    try:
        # 切换到backend目录直接执行start-servers.js
        backend_dir = ROOT_DIR / "backend"
        start_script = backend_dir / "start-servers.js"
        
        if start_script.exists():
            # 使用node直接执行start-servers.js
            os.chdir(backend_dir)
            os.execvp("node", ["node", "start-servers.js"])
        else:
            # 回退到使用server_manager.py
            os.chdir(ROOT_DIR)
            os.execvp("python", ["python", "server_manager.py", "--backend-only"])
    
    except Exception as e:
        print_colored(f"启动后端服务器时出错: {e}", "1;31")
        print_colored("请尝试手动运行: cd backend && node start-servers.js", "1;33")

if __name__ == "__main__":
    main()