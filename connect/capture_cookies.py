#!/usr/bin/env python3

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.firefox.service import Service as FirefoxService
from webdriver_manager.firefox import GeckoDriverManager
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
    """Run 'nproc' to get the number of CPU cores."""
    try:
        output = subprocess.check_output(['nproc'], text=True).strip()
        return int(output)
    except Exception as e:
        print(f"Could not determine CPU count: {e}")
        return 1

def get_default_browser_binary():
    """Detects the path to the default browser executable on Linux."""
    try:
        # 1. Ask xdg-settings
        try:
            cmd = ['xdg-settings', 'get', 'default-web-browser']
            desktop_filename = subprocess.check_output(cmd, text=True).strip()
        except:
            desktop_filename = ""

        # 2. Fallback if xdg-settings fails
        if not desktop_filename:
            if shutil.which("firefox"): return shutil.which("firefox")
            if shutil.which("brave"): return shutil.which("brave")
            return None

        # 3. Find the .desktop file
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
            if "firefox" in desktop_filename.lower(): return shutil.which("firefox")
            return None

        # 4. Parse Exec line
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

def force_kill_process(pid):
    """Kill a process and its children forcefully."""
    try:
        parent = psutil.Process(pid)
        for child in parent.children(recursive=True):
            child.kill()
        parent.kill()
    except psutil.NoSuchProcess:
        pass

def capture_cookies():
    base_dir = os.path.join(os.path.expanduser("~"), ".local/share/gnome-shell/extensions/LogtimeWidget@zsonie", "utils")
    output_file = os.path.join(base_dir, ".intra42_cookies.json")
    log_file = os.path.join(base_dir, ".cookie_capture.log")
    
    # --- FIX 1: Set Custom TMPDIR for Snap Compatibility ---
    custom_tmp = os.path.join(os.path.expanduser("~"), ".cache", "selenium_tmp")
    if os.path.exists(custom_tmp):
        try:
            shutil.rmtree(custom_tmp) 
        except: 
            pass
    os.makedirs(custom_tmp, exist_ok=True)
    os.environ["TMPDIR"] = custom_tmp
    
    os.makedirs(base_dir, exist_ok=True)
    sys.stdout = open(log_file, 'w')
    sys.stderr = sys.stdout
    
    print(f"Script started. Time: {time.ctime()}")
    print(f"Using TMPDIR: {custom_tmp}")
    
    driver = None
    driver_pid = None
    
    # --- DECISION LOGIC (CPU Check) ---
    cpu_cores = get_cpu_count()
    print(f"Detected CPU Cores: {cpu_cores}")
    
    # Define fallback priority based on power
    if cpu_cores > 4:
        print("High core count: Preferring Brave in fallback.")
        fallback_priority = [
            "/usr/bin/brave", 
            "/usr/bin/brave-browser", 
            "/usr/bin/google-chrome", 
            "/usr/bin/chromium"
        ]
    else:
        print("Low core count: Preferring Chrome/Chromium in fallback.")
        fallback_priority = [
            "/usr/bin/google-chrome", 
            "/usr/bin/chromium", 
            "/usr/bin/brave", 
            "/usr/bin/brave-browser"
        ]

    # 1. Try Default Browser First
    default_bin = get_default_browser_binary()
    
    if default_bin:
        print(f"Detected default browser binary: {default_bin}")
        try:
            if "firefox" in default_bin.lower():
                print("Initializing Firefox...")
                options = FirefoxOptions()
                options.binary_location = default_bin
                options.set_preference("profile", custom_tmp)
                
                driver_path = GeckoDriverManager().install()
                service = FirefoxService(executable_path=driver_path, env={"TMPDIR": custom_tmp})
                driver = webdriver.Firefox(service=service, options=options)
                
            else:
                print("Initializing Default (Chrome/Brave)...")
                options = ChromeOptions()
                options.binary_location = default_bin
                service = ChromeService(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=options)
                
        except Exception as e:
            print(f"Failed to launch default browser: {e}")
            driver = None

    # 2. Smart Fallback Logic
    if not driver:
        print("Falling back to alternative browsers...")
        
        # Find first available browser from our priority list
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
        else:
            print("No compatible fallback browser found in priority list.")

    if not driver:
        print("CRITICAL ERROR: No browser could be started.")
        return False
        
    try:
        driver_pid = driver.service.process.pid
    except:
        driver_pid = None

    # 3. Main Automation Logic
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
        if driver:
            try:
                driver.quit()
            except:
                pass
        
        if driver_pid:
            time.sleep(2)
            if psutil.pid_exists(driver_pid):
                print(f"Force killing driver PID {driver_pid}...")
                force_kill_process(driver_pid)
        
        try:
            shutil.rmtree(custom_tmp)
        except:
            pass
        print("Done.")

if __name__ == "__main__":
    capture_cookies()
