---
applyTo: '**'
---
We are using a venv for this project. To set it up, follow these steps:
1. **Create a virtual environment**: Run the command `python -m venv .venv` in your terminal.
2. **Activate the virtual environment**:
   - On Windows: Run `venv\Scripts\activate`
   - On macOS/Linux: Run `source venv/bin/activate`
3. **Install dependencies**: Run `pip install -r requirements.txt` to install all necessary packages.
4. **Deactivate the virtual environment**: When you're done, you can deactivate it by running `deactivate`.
5. **Re-activate the virtual environment**: Whenever you return to this project, remember to activate the virtual environment again using the command from step 2.
6. **Run the application**: Use `python main.py` to start the application after activating the virtual environment.
7. **Install pre-commit hooks**: Run `pre-commit install` to set up pre-commit hooks for code quality checks.
8. **Run pre-commit checks**: You can manually run pre-commit checks with `pre-commit run --all-files` to ensure your code adheres to the project's standards.

Always run server with the virtual environment activated to ensure all dependencies are correctly loaded. If you encounter any issues, check the `requirements.txt` file for the required packages and their versions.
If you need to update the dependencies, you can run `pip install -U -r requirements.txt` to upgrade them to the latest versions specified in the file.

We also have a ./dev.sh script that can be used to run the application with the virtual environment activated. You can execute it by running `./dev.sh` in your terminal.
Make sure to have the necessary permissions to execute the script. This script will handle activating the virtual environment and starting the application for you.

We are working with python3 not python.
Make sure to use `python3` commands instead of `python` if your system differentiates between Python 2 and Python 3.