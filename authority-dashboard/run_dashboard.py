import os
import subprocess
import sys
import time

def main():
    print("Starting FastAPI Backend Server...")
    api_path = os.path.join(os.path.dirname(__file__), "api.py")
    
    # Start the backend server in the background
    backend_process = None
    if os.path.exists(api_path):
        try:
            backend_process = subprocess.Popen([sys.executable, "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"])
            print("FastAPI server started on port 8000")
            time.sleep(2) # Give it a moment to start
        except Exception as e:
            print(f"Failed to start backend server: {e}")
    else:
        print(f"Warning: Backend API {api_path} not found. Continuing without backend.")

    print("\nStarting Crowd & Police Patrol Management Dashboard...")
    app_path = os.path.join(os.path.dirname(__file__), "app", "main.py")
    
    if not os.path.exists(app_path):
        print(f"Error: {app_path} not found.")
        if backend_process:
            backend_process.terminate()
        sys.exit(1)
        
    try:
        subprocess.run([sys.executable, "-m", "streamlit", "run", app_path], check=True)
    except Exception as e:
        print(f"Dashboard exited: {e}")
    finally:
        if backend_process:
            print("Terminating FastAPI Backend Server...")
            backend_process.terminate()
            backend_process.wait()

if __name__ == "__main__":
    main()
