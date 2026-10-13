"""
打印日志文件名，并添加时间戳，并重命名，便于管理

"""
import os
import time
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class LogHandler(FileSystemEventHandler):
    def __init__(self, log_directory):
        self.log_directory = log_directory
        self.pending_files = []  # 存储待处理的文件路径
        self.processed_files = set()  # 存储已处理的文件名

    def on_created(self, event):
        if event.is_directory:
            return
        
        filename = os.path.basename(event.src_path)
        if filename.endswith('.md') and filename not in self.processed_files:
            # 将新文件添加到待处理列表
            self.pending_files.append(event.src_path)
            print(f"发现新文件: {filename}，已添加到待处理列表(当前待处理文件数: {len(self.pending_files)})")

    def process_all_pending_files(self):
        """处理所有待处理的文件"""
        if not self.pending_files:
            print("没有待处理的文件")
            return

        print(f"\n开始批量处理 {len(self.pending_files)} 个待处理文件...")
        for file_path in self.pending_files:
            self.process_file(file_path)
        
        # 清空待处理文件列表
        self.pending_files = []
        print("所有文件处理完成")

    def process_file(self, file_path):
        """处理单个文件：添加时间戳并重命名"""
        filename = os.path.basename(file_path)
        if filename in self.processed_files:
            print(f"文件 {filename} 已经处理过，跳过")
            return

        try:
            # 获取当前时间
            current_time = datetime.now()
            current_time_str = current_time.strftime('%y%m%d')  # 获取年份后两位和日期

            # 读取文件内容
            with open(file_path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # 添加时间戳
            new_content = f"# 创建时间: {current_time.strftime('%Y-%m-%d %H:%M:%S')}\n\n{content}"
            
            # 写入新内容
            with open(file_path, 'w', encoding='utf-8') as file:
                file.write(new_content)
            
            # 修改文件名，添加年份后两位和日期信息
            new_file_name = f"{current_time_str}-{os.path.basename(file_path)}"
            new_file_path = os.path.join(self.log_directory, new_file_name)
            os.rename(file_path, new_file_path)
            
            # 记录已处理的文件
            self.processed_files.add(filename)
            print(f"已成功处理文件: {filename} → {new_file_name}")
        except Exception as e:
            print(f"处理文件 {filename} 时出错: {str(e)}")

if __name__ == "__main__":
    log_directory = os.path.join(os.path.dirname(__file__), "../日志/项目日志")  # 从下级文件找到目标文件
    
    # 检查目录是否存在
    if not os.path.exists(log_directory):
        print(f"错误: 目录 {log_directory} 不存在")
        exit(1)
    
    event_handler = LogHandler(log_directory)
    observer = Observer()
    observer.schedule(event_handler, path=log_directory, recursive=False)
    
    print(f"正在监控目录: {log_directory}")
    print("监控已启动，检测到新MD文件会添加到待处理列表")
    print("输入'1'并按回车以批量处理所有待处理文件")
    print("输入'q'并按回车以退出程序")
    
    observer.start()
    
    try:
        while True:
            # 等待用户输入命令
            command = input("\n请输入命令 (1:处理文件 q:退出): ")
            
            if command == '1':
                event_handler.process_all_pending_files()
            elif command.lower() == 'q':
                print("正在退出...")
                break
            else:
                print("无效命令，请输入'1'处理文件或'q'退出")
            
            time.sleep(0.1)  # 短暂休眠以减少CPU占用
    except KeyboardInterrupt:
        print("\n检测到中断，正在退出...")
    finally:
        observer.stop()
        observer.join()
        print("监控已停止")