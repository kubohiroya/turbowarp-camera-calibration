# SPDX-License-Identifier: MPL-2.0
#
# What this extension asks OpenCV for, and nothing else.
#
# The stock @techstark/opencv-js build is 10.9 MB of general-purpose OpenCV, of
# which this extension calls twenty-three symbols. It also could not be made to
# finish initializing inside a Web Worker, which is where the solver has to run:
# a twenty-millisecond detection and a one-second solve on the thread that draws
# the stage are a stuttering preview and a frozen one.
#
# Kept beside the code that calls them. A list of exported functions is only
# correct relative to a set of call sites, and the two drifting apart is how the
# stock build came to be missing findChessboardCorners for five releases.

core = {
    '': [
        'absdiff', 'meanStdDev', 'split', 'merge',
    ],
    'Algorithm': [],
}

imgproc = {
    '': [
        'cvtColor', 'Laplacian',
    ],
}

calib3d = {
    '': [
        # The solve, and the reprojection of views held out of it.
        'calibrateCameraExtended', 'solvePnP', 'projectPoints',
    ],
}

objdetect = {
    # ArUco and ChArUco live here in OpenCV 4.x.
    '': [
        'getPredefinedDictionary',
    ],
    'aruco_Dictionary': [
        'Dictionary', 'generateImageMarker', 'getDistanceToId',
    ],
    'aruco_Board': [],
    'aruco_CharucoBoard': [
        'CharucoBoard', 'getChessboardCorners', 'generateImage',
        'checkCharucoCornersCollinear', 'matchImagePoints',
    ],
    'aruco_CharucoParameters': ['CharucoParameters'],
    'aruco_DetectorParameters': ['DetectorParameters'],
    'aruco_RefineParameters': ['RefineParameters'],
    'aruco_CharucoDetector': [
        'CharucoDetector', 'detectBoard', 'setBoard',
        'setCharucoParameters', 'setDetectorParameters', 'setRefineParameters',
    ],
}

white_list = makeWhiteList([core, imgproc, calib3d, objdetect])  # noqa: F821
