import os

# Check if "assets" folder exists
folderPath = os.path.join(os.getcwd(), "assets")

if not os.path.exists(folderPath):
    os.makedirs(folderPath)
    print("Created 'assets' folder")
else:
    print("'assets' folder already exists")

#%% Create a profile
def createProfile(profileName):
    folderName = os.path.join(os.getcwd(), "assets/" + str(profileName))
    
    if not os.path.exists(folderName):
        os.makedirs(folderName)
        print("Created '" + str(profileName) + "' profile")
    else:
        print("'" + str(profileName) + "' profile already exists")