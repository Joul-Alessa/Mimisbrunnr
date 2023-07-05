import os
import shutil

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

#%% Delete a profile
def deleteProfile(profileName):
    folderName = os.path.join(os.getcwd(), "assets/" + str(profileName))
    
    if os.path.exists(folderName):
        shutil.rmtree(folderName)
        print("Deleted '" + str(profileName) + "' profile")
    else:
        print("'" + str(profileName) + "' profile does not exist")