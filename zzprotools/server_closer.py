#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
服务器关闭工具 - 专门用于关闭运行中的服务器进程
"""

import os
import sys
import signal
import subprocess
import argparse

# 需要关闭的端口列表
# DEFAULT_PORTS = [3001, 3002, 3003, 5173, 5174]
DEFAULT_PORTS = [3001, 3002, 3003]

def find_process_by_port(port):
    """查找指定端口的进程ID"""
    try:
        # 执行lsof命令查找占用指定端口的进程
        result = subprocess.run(['lsof', '-t', '-i', f'tcp:{port}'], 
                               capture_output=True, text=True, check=False)
        if result.stdout.strip():
            return int(result.stdout.strip())
        return None
    except Exception as e:
        print(f"查找端口 {port} 的进程时出错: {e}")
        return None


def kill_process(pid):
    """结束指定进程"""
    try:
        # 发送SIGKILL信号结束进程
        os.kill(pid, signal.SIGKILL)
        print(f"已结束进程 (PID: {pid})")
        return True
    except Exception as e:
        print(f"结束进程 {pid} 时出错: {e}")
        return False


def kill_port(port):
    """结束占用指定端口的进程"""
    pid = find_process_by_port(port)
    if pid:
        print(f"正在关闭端口 {port} 上的进程 (PID: {pid})...")
        kill_process(pid)
        return True
    else:
        print(f"端口 {port} 没有运行中的进程")
        return False


def close_servers(ports=None, backend_only=False, frontend_only=False):
    """关闭指定端口上的服务器"""
    if ports is None:
        ports = DEFAULT_PORTS

    # 根据参数过滤端口
    if backend_only:
        # 仅关闭后端端口 (3001-3003)
        ports = [p for p in ports if p < 5000]
    elif frontend_only:
        # 仅关闭前端端口 (5173-5174)
        ports = [p for p in ports if p >= 5000]

    print(f"正在关闭以下端口上的服务器: {', '.join(map(str, ports))}")
    
    # 关闭所有指定端口上的进程
    closed_count = 0
    for port in ports:
        if kill_port(port):
            closed_count += 1
    
    if closed_count > 0:
        print(f"已成功关闭 {closed_count} 个服务器进程")
    else:
        print("没有发现需要关闭的服务器进程")


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description='服务器关闭工具')
    parser.add_argument('--ports', nargs='+', type=int, 
                        help='要关闭的端口列表，默认为 3001 3002 3003 5173 5174')
    parser.add_argument('--backend-only', action='store_true', 
                        help='仅关闭后端服务器 (端口 3001-3003)')
    parser.add_argument('--frontend-only', action='store_true', 
                        help='仅关闭前端服务器 (端口 5173-5174)')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    
    close_servers(
        ports=args.ports,
        backend_only=args.backend_only,
        frontend_only=args.frontend_only
    )
    
    print("服务器关闭操作完成") 