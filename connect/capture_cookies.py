#!/usr/bin/env python3

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
import os
import time
import sys

def capture_cookies():
    """
    Automatically capture cookies when login is detected
    Save only the _intra_42_session_production cookie value
    """
    # Force absolute path for output file
    output_file = os.path.join(
        os.path.expanduser("~"),
        ".local/share/gnome-shell/extensions/LogtimeWidget@zsonie",
        "utils/intra42_cookies.json"
    )
    
    # Log file to debug
    log_file = os.path.join(
        os.path.expanduser("~"),
        ".local/share/gnome-shell/extensions/LogtimeWidget@zsonie",
        "utils/cookie_capture.log"
    )
    
    # Redirect stdout and stderr to log file
    sys.stdout = open(log_file, 'w')
    sys.stderr = sys.stdout
    
    print(f"Script started, will write to: {output_file}")
    print(f"Current working directory: {os.getcwd()}")
    
    chrome_options = Options()
    brave_paths = ["/usr/bin/brave", "/usr/bin/brave-browser", "/opt/brave.com/brave/brave"]
    brave_path = next((p for p in brave_paths if os.path.exists(p)), None)
    
    if brave_path:
        chrome_options.binary_location = brave_path
        print(f"Using Brave from: {brave_path}")
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
        print("Browser started successfully")
    except Exception as e:
        print(f"Error starting browser: {e}")
        return False
    
    try:
        driver.get("https://profile.intra.42.fr/")
        print("Navigated to intra42")
        
        wait = WebDriverWait(driver, 600)
        
        def cookies_present(driver):
            cookies = driver.get_cookies()
            return any(c['name'] == '_intra_42_session_production' for c in cookies)
        
        print("Waiting for login...")
        wait.until(cookies_present)
        time.sleep(2)
        
        cookies = driver.get_cookies()
        session_value = None
        
        for cookie in cookies:
            if cookie['name'] == '_intra_42_session_production':
                session_value = cookie['value']
                break
        
        if session_value:
            print(f"Found cookie value: {session_value}")
            print(f"Writing to file: {output_file}")
            
            with open(output_file, "w") as f:
                f.write(session_value)
            
            print(f"File written successfully!")
            print(f"File exists: {os.path.exists(output_file)}")
            return True
        else:
            print("Session cookie not found!")
            return False
            
    except Exception as e:
        print(f"Error during capture: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        print("Closing browser...")
        try:
            driver.close()
        except:
            pass
        try:
            driver.quit()
        except:
            pass
        print("Script finished")

if __name__ == "__main__":
    capture_cookies()
