#!/usr/bin/env python3

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager

import subprocess
import configparser
import shutil
import os
import time
import sys
import psutil

def get_cpu_count():
    try:
        output = subprocess.check_output(['nproc'], text=True).strip()
        return int(output)
    except:
        return 1

def get_default_browser_binary():
    try:
        # 1. Ask xdg-settings
        try:
            cmd = ['xdg-settings', 'get', 'default-web-browser']
            desktop_filename = subprocess.check_output(cmd, text=True).strip()
        except:
            desktop_filename = ""

        # 2. Fallback checks (Removed Firefox)
        if not desktop_filename:
            if shutil.which("brave"): return shutil.which("brave")
            if shutil.which("google-chrome"): return shutil.which("google-chrome")
            if shutil.which("chromium"): return shutil.which("chromium")
            return None

        # 3. Find desktop file
        search_paths = [
            os.path.expanduser('~/.local/share/applications'),
            '/usr/share/applications',
            '/usr/local/share/applications',
            '/var/lib/snapd/desktop/applications'
        ]
        
        desktop_path = None
        for path in search_paths:
            candidate = os.path.join(path, desktop_filename)
            if os.path.exists(candidate):
                desktop_path = candidate
                break
        
        if not desktop_path:
            return None

        # 4. Parse Exec
        config = configparser.ConfigParser(interpolation=None)
        config.read(desktop_path)
        
        if 'Desktop Entry' in config and 'Exec' in config['Desktop Entry']:
            exec_line = config['Desktop Entry']['Exec']
            cmd = exec_line.split()[0]
            if not os.path.isabs(cmd):
                return shutil.which(cmd)
            return cmd
            
    except Exception as e:
        print(f"Warning: Could not detect default browser: {e}")
    
    return None

def capture_cookies():
    base_dir = os.path.join(os.path.expanduser("~"), ".local/share/gnome-shell/extensions/LogtimeWidget@zsonie", "utils")
    output_file = os.path.join(base_dir, ".intra42_cookies.json")
    log_file = os.path.join(base_dir, ".cookie_capture.log")
    
    # Fix for Snap (Useful even for Chromium snaps)
    custom_tmp = os.path.join(os.path.expanduser("~"), ".cache", "selenium_tmp")
    if os.path.exists(custom_tmp):
        try: shutil.rmtree(custom_tmp) 
        except: pass
    os.makedirs(custom_tmp, exist_ok=True)
    os.environ["TMPDIR"] = custom_tmp
    
    os.makedirs(base_dir, exist_ok=True)
    sys.stdout = open(log_file, 'w')
    sys.stderr = sys.stdout
    
    print(f"Script started. Time: {time.ctime()}")
    
    driver = None
    driver_pid = None
    
    # CPU Check
    cpu_cores = get_cpu_count()
    print(f"Detected CPU Cores: {cpu_cores}")
    
    # Removed Firefox from priority list
    if cpu_cores > 4:
        fallback_priority = ["/usr/bin/brave", "/usr/bin/google-chrome", "/usr/bin/chromium"]
    else:
        fallback_priority = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/brave"]

    # 1. Default Browser
    default_bin = get_default_browser_binary()
    if default_bin:
        # Ensure we don't accidentally try to use Firefox if it was detected
        if "firefox" in default_bin.lower():
            print("Firefox detected as default but support is disabled. Skipping to fallback.")
        else:
            print(f"Detected default browser: {default_bin}")
            try:
                print("Initializing Chrome/Brave...")
                options = ChromeOptions()
                options.binary_location = default_bin
                service = ChromeService(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=options)
            except Exception as e:
                print(f"Default browser failed: {e}")
                driver = None

    # 2. Fallback
    if not driver:
        fallback_path = next((p for p in fallback_priority if os.path.exists(p)), None)
        if fallback_path:
            print(f"Fallback selected: {fallback_path}")
            try:
                options = ChromeOptions()
                options.binary_location = fallback_path
                service = ChromeService(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=options)
            except Exception as e:
                print(f"Fallback failed: {e}")

    if not driver:
        print("CRITICAL ERROR: No browser started.")
        return False
        
    try:
        driver_pid = driver.service.process.pid
    except:
        driver_pid = None

    # 3. Automation
    try:
        driver.get("https://profile.intra.42.fr/")
        wait = WebDriverWait(driver, 600)
        
        def cookies_present(driver):
            cookies = driver.get_cookies()
            return any(c['name'] == '_intra_42_session_production' for c in cookies)
        
        wait.until(cookies_present)
        time.sleep(1)
        
        cookies = driver.get_cookies()
        session_value = next((c['value'] for c in cookies if c['name'] == '_intra_42_session_production'), None)
        
        if session_value:
            with open(output_file, "w") as f:
                f.write(session_value)
            print(f"SUCCESS: Cookie captured.")
            return True
        else:
            return False
            
    except Exception as e:
        print(f"Runtime Error: {e}")
        return False
        
    finally:
        print("Closing browser...")
        
        procs_to_kill = []
        if driver_pid and psutil.pid_exists(driver_pid):
            try:
                parent = psutil.Process(driver_pid)
                procs_to_kill.append(parent)
                procs_to_kill.extend(parent.children(recursive=True))
            except psutil.NoSuchProcess:
                pass

        if driver:
            try:
                driver.quit()
            except:
                pass
        
        time.sleep(1) 
        for p in procs_to_kill:
            try:
                if p.is_running():
                    print(f"Force killing leftover process: {p.name()} ({p.pid})")
                    p.kill()
            except:
                pass
        
        try:
            shutil.rmtree(custom_tmp)
        except:
            pass
        print("Done.")

if __name__ == "__main__":
    capture_cookies()
