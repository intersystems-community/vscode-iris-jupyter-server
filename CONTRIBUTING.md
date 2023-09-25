# CONTRIBUTING
Some notes for people wanting to contribute to this project.

## Building and testing in a dev container

1. Clone this GitHub repo (intersystems-community/vscode-iris-jupyter-server).
2. Open the local folder in VS Code. If prompted, install recommended extensions.
3. When a notification appears, choose to `Reopen in Container`. If it doesn't appear, click the `><` panel at the left end of the status bar and choose `Reopen in Container` from the quickpick that appears.
4. When "Starting Dev Container (show log)" notification appears, click on it to display progress.
5. If notified "Configuration file(s) changed", click `Rebuild`.
6. If notified "Git not found", click either `X` or `Don't Show Again` unless you intend using the dev container to make changes to the cloned repo.
7. If notified about application on port 1972, click `X`.
8. When the dev container has finished starting, the "Configuring Dev Container (show log)" notification will disappear.
9. Use the Activity Bar to switch to "Run and Debug".
10. Start debugging with the "Run Extension" configuration.
11. The Extension Development Host (EDH) window opens after "Building..." spinner in status bar has finished. If it notifies you "Configuration file(s) changed", click `Ignore`. If any notification about app ports appears, click `X` to dismiss it.
12. In EDH's Explorer view, open the file `polyglot1.ipynb`
13. If you get a notification about security in relation to connecting over HTTP without a token, click `Yes` or `Do not show again`.
14. Click the `Select Kernel` button in the upper right of the notebook. Choose `Existing Jupyter server...`. If the next quickpick already contains an entry `Remote - localhost` then select it. Otherwise opt to enter a URL and enter `http://localhost:50773/devcontainer:user?token=` when prompted. On the next prompt ("Change Server Display Name") just press Enter.
15. Click the `Run All` button. You should see an output cell appear underneath each of the three code cells.
