import os

# Check if "assets" folder exists
folderPath = os.path.join(os.getcwd(), "assets")

if not os.path.exists(folderPath):
    os.makedirs(folderPath)
    print("Created 'assets' folder")
else:
    print("'assets' folder already exists")