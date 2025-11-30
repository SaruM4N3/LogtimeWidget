#!/usr/bin/env python3

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager

import subprocess
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
    
    # --- CPU CHECK ---
    cpu_cores = get_cpu_count()
    # cpu_cores = 4
    print(f"Detected CPU Cores: {cpu_cores}")
    
    # Define Priority List based on Power
    if cpu_cores > 4:
        print("High core count: Preferring Brave.")
        priority_list = [
            "/usr/bin/brave", 
            "/usr/bin/brave-browser", 
            "/usr/bin/google-chrome", 
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser"
        ]
    else:
        print("Low core count: Preferring Chrome/Chromium.")
        priority_list = [
            "/usr/bin/google-chrome", 
            "/usr/bin/chromium", 
            "/usr/bin/chromium-browser",
            "/usr/bin/brave", 
            "/usr/bin/brave-browser"
        ]

    # --- LAUNCH LOGIC ---
    for browser_path in priority_list:
        if not os.path.exists(browser_path):
            continue
            
        print(f"Attempting to launch: {browser_path}")
        try:
            options = ChromeOptions()
            options.binary_location = browser_path
            service = ChromeService(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=options)
            
            print(f"Successfully launched: {browser_path}")
            break # Stop loop if successful
        except Exception as e:
            print(f"Failed to launch {browser_path}: {e}")
            driver = None

    if not driver:
        print("CRITICAL ERROR: No browser could be started.")
        return False
        
    try:
        driver_pid = driver.service.process.pid
    except:
        driver_pid = None

    # --- AUTOMATION ---
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
