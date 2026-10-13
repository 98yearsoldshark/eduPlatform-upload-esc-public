#!/usr/bin/env python3
"""
项目快速压缩备份工具

特点:
1. 自动排除常见的依赖和构建产物目录
2. 支持自定义选择要排除的目录类型
3. 交互式操作流程
4. 压缩包命名支持添加自定义备注
5. 完成后显示压缩包大小
"""

import os
import sys
import time
import shutil
import zipfile
from datetime import datetime

# 可配置的排除目录类型列表
# 每项格式为: [目录名, 描述, 默认是否排除]
EXCLUDE_DIR_TYPES = [
    ["node_modules", "Node.js依赖包，通常很大", True],
    [".next", "Next.js构建产物，通常很大", True],
    ["dist", "前端项目构建产物", True],
    ["build", "常见构建产物目录", True],
    # ["target", "Java/Rust等项目的构建目录", True],
    ["__pycache__", "Python字节码缓存", True],
    # [".git", "Git版本控制目录", False],
    ["logs", "日志文件目录", False],
    # [".vscode", "VSCode配置目录", False],
    # [".idea", "IntelliJ IDE配置目录", False]
]

def get_size_format(bytes, decimal_places=2):
    """将字节大小转换为人类可读的格式"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes < 1024.0:
            return f"{bytes:.{decimal_places}f} {unit}"
        bytes /= 1024.0
    return f"{bytes:.{decimal_places}f} PB"

def count_files(directory, exclude_dirs=None):
    """计算目录中的文件总数（排除指定目录）"""
    if exclude_dirs is None:
        exclude_dirs = []

    file_count = 0
    for root, dirs, files in os.walk(directory):
        # 修改dirs列表以跳过排除的目录
        dirs[:] = [d for d in dirs if os.path.join(root, d) not in exclude_dirs]
        
        file_count += len(files)
    
    return file_count

def find_project_root():
    """查找项目根目录（当前工作目录）"""
    return os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

def backup_project(project_path, backup_note, exclude_dir_names):
    """
    压缩备份项目，排除指定的目录
    
    Args:
        project_path: 项目根目录路径
        backup_note: 备份注释，将添加到文件名
        exclude_dir_names: 要排除的目录名称列表
    
    Returns:
        tuple: (成功状态, 压缩包路径)
    """
    try:
        # 创建时间戳
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 获取项目名称
        project_name = os.path.basename(project_path)
        
        # 创建压缩包文件名
        if backup_note:
            zip_filename = f"{timestamp}_{project_name}_{backup_note}.zip"
        else:
            zip_filename = f"{timestamp}_{project_name}.zip"
        
        # 压缩包保存路径
        backup_dir = os.path.join(os.path.dirname(project_path), "0项目备份")
        os.makedirs(backup_dir, exist_ok=True)
        zip_path = os.path.join(backup_dir, zip_filename)
        
        print(f"\n开始压缩备份...")
        print(f"源目录: {project_path}")
        print(f"目标文件: {zip_path}")
        
        # 查找所有需要排除的目录
        exclude_dirs = []
        total_size = 0
        
        for root, dirs, files in os.walk(project_path):
            for dir_name in dirs:
                if dir_name in exclude_dir_names:
                    full_path = os.path.join(root, dir_name)
                    exclude_dirs.append(full_path)
                    
                    # 计算目录大小
                    try:
                        dir_size = sum(os.path.getsize(os.path.join(dirpath, filename))
                                  for dirpath, _, filenames in os.walk(full_path)
                                  for filename in filenames)
                        total_size += dir_size
                        print(f"发现并排除: {full_path} ({get_size_format(dir_size)})")
                    except Exception as e:
                        print(f"计算目录大小出错 {full_path}: {str(e)}")
        
        print(f"\n共发现 {len(exclude_dirs)} 个需要排除的目录，总大小: {get_size_format(total_size)}")
        
        # 统计要压缩的文件数量
        file_count = count_files(project_path, exclude_dirs)
        print(f"将要压缩 {file_count} 个文件...")
        
        # 创建压缩文件
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            file_count = 0
            for root, dirs, files in os.walk(project_path):
                # 检查当前目录是否在排除列表中
                if any(root.startswith(exclude_dir) for exclude_dir in exclude_dirs):
                    continue
                
                # 修改dirs列表以避免遍历排除的目录
                dirs[:] = [d for d in dirs if os.path.join(root, d) not in exclude_dirs]
                
                for file in files:
                    file_path = os.path.join(root, file)
                    # 计算文件在压缩包中的路径
                    arcname = os.path.relpath(file_path, os.path.dirname(project_path))
                    
                    try:
                        # 添加文件到压缩包
                        zipf.write(file_path, arcname)
                        
                        file_count += 1
                        if file_count % 100 == 0:
                            print(f"已压缩 {file_count} 个文件...", end="\r")
                    except Exception as e:
                        print(f"\n添加文件出错 {file_path}: {str(e)}")
        
        # 获取压缩包大小
        zip_size = os.path.getsize(zip_path)
        
        print(f"\n压缩完成! 共压缩了 {file_count} 个文件")
        print(f"压缩包大小: {get_size_format(zip_size)}")
        print(f"压缩包路径: {zip_path}")
        
        return True, zip_path
    
    except Exception as e:
        print(f"压缩过程中出错: {str(e)}")
        return False, None

def get_exclude_dir_choices():
    """让用户选择要排除的目录类型"""
    selected_dirs = []
    
    print("\n请选择要排除的目录类型：")
    print("=" * 60)
    
    for i, (dir_name, description, default) in enumerate(EXCLUDE_DIR_TYPES, 1):
        default_mark = "[默认排除]" if default else "[默认包含]"
        print(f"{i}. {dir_name:<15} - {description} {default_mark}")
    
    print("=" * 60)
    print("输入示例: 1,2,3 表示选择前三项")
    print("输入 0 表示全部选择")
    print("输入 default 表示使用默认设置")
    print("输入 none 表示全部不排除")
    
    while True:
        choice = input("\n请输入要排除的目录编号(用逗号分隔): ").strip().lower()
        
        if choice == '0':
            return [item[0] for item in EXCLUDE_DIR_TYPES]
        elif choice == 'none':
            return []
        elif choice == 'default':
            return [item[0] for item in EXCLUDE_DIR_TYPES if item[2]]
        else:
            try:
                # 解析用户输入的编号
                selected_indices = [int(x.strip()) for x in choice.split(',') if x.strip()]
                
                # 检查输入是否有效
                if all(1 <= idx <= len(EXCLUDE_DIR_TYPES) for idx in selected_indices):
                    selected_dirs = [EXCLUDE_DIR_TYPES[idx-1][0] for idx in selected_indices]
                    
                    print("\n您选择排除以下目录类型:")
                    for dir_name in selected_dirs:
                        print(f"- {dir_name}")
                    
                    confirm = input("\n确认以上选择? (y/n): ").strip().lower()
                    if confirm == 'y':
                        return selected_dirs
                else:
                    print(f"错误: 请输入1到{len(EXCLUDE_DIR_TYPES)}之间的编号")
            except ValueError:
                print("错误: 请输入有效的编号，用逗号分隔")

def main():
    # 找到项目根目录
    project_path = find_project_root()
    
    print("=" * 60)
    print(f"项目快速备份工具")
    print("=" * 60)
    print(f"识别到项目路径: {project_path}")
    print(f"项目名称: {os.path.basename(project_path)}")
    
    # 获取用户选择的排除目录
    exclude_dir_names = get_exclude_dir_choices()
    
    # 确认是否继续
    confirmation = input("\n是否开始压缩备份? (y/n): ").strip().lower()
    if confirmation != 'y':
        print("操作已取消，程序退出")
        sys.exit(0)
    
    # 获取备注
    backup_note = input("\n请输入备份说明(将添加到文件名中): ").strip()
    
    # 执行备份
    success, zip_path = backup_project(project_path, backup_note, exclude_dir_names)
    
    if success:
        print("\n备份成功完成!")
    else:
        print("\n备份过程失败!")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n操作被用户中断，程序退出")
        sys.exit(1) 