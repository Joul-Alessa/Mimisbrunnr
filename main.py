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

#%% Edit a profile name
def editProfile(oldName, newName):
    oldFolderName = os.path.join(os.getcwd(), "assets/" + str(oldName))
    newFolderName = os.path.join(os.getcwd(), "assets/" + str(newName))
    
    if os.path.exists(oldFolderName):
        os.rename(oldFolderName, newFolderName)
        print("Changed '" + str(oldName) + "' profile name to '" + str(newName) + "' profile name")
    else:
        print("'" + str(oldName) + "' profile does not exist")

#%% Delete a profile
def deleteProfile(profileName):
    folderName = os.path.join(os.getcwd(), "assets/" + str(profileName))
    
    if os.path.exists(folderName):
        shutil.rmtree(folderName)
        print("Deleted '" + str(profileName) + "' profile")
    else:
        print("'" + str(profileName) + "' profile does not exist")