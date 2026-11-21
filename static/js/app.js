/**
 * PlantCare — SaaS Workspace Controller
 * Pure Vanilla JavaScript (ES6+)
 *
 * Security note:
 *  - Session Bearer tokens are held strictly in memory (never localStorage/sessionStorage).
 *  - All untrusted strings rendered into markup are escaped with escapeHtml().
 */

(() => {
  "use strict";

  const API_ENDPOINTS = {
    AUTH_STATUS: "/api/auth/bootstrap-status",
    AUTH_REGISTER: "/api/auth/register",
    AUTH_LOGIN: "/api/auth/login",
    AUTH_LOGOUT: "/api/auth/logout",
    AUTH_ME: "/api/auth/me",
    AUTH_PROFILE: "/api/auth/profile",
    AUTH_CLAIM_ADMIN: "/api/auth/claim-admin",
    PREDICT: "/api/predict",
    HISTORY: "/api/history",
    STATS: "/api/stats",
    ANALYTICS: "/api/analytics",
    WEATHER: "/api/weather",
    ADMIN_OVERVIEW: "/api/admin/overview",
    ADMIN_USERS: "/api/admin/users",
    ADMIN_SCANS: "/api/admin/scans",
    ADMIN_AUDIT: "/api/admin/audit-logs",
  };

  const UPLOAD_CONSTRAINTS = {
    MAX_SIZE_BYTES: 10 * 1024 * 1024,
    ALLOWED_MIME_TYPES: ["image/jpeg", "image/png"],
    ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png"],
  };

  const LANGUAGE_STORAGE_KEY = "plantcare_lang";
  const VALID_VIEWS = ["overview", "detect", "weather", "analytics", "history", "admin", "about"];

  /* ------------------------------------------------------------------------
     Bilingual Translations (English & Hindi) — Zero "AI" wording
     ------------------------------------------------------------------------ */
  const TRANSLATIONS = {
    en: {
      pageTitle: "PlantCare — Plant Disease Detection & Health Monitoring",
      brandName: "PlantCare",
      navGroupWorkspace: "Workspace",
      navGroupSystem: "Operations",
      navOverview: "Overview",
      navDetect: "Detect Disease",
      navWeather: "Live Weather",
      navAnalytics: "Analytics",
      navHistory: "Scan History",
      navAdmin: "Admin Console",
      navAbout: "About",
      headerScanBtn: "Scan Leaf",
      languageLabel: "Select Language",
      guestUserLabel: "Guest Workspace",
      guestRoleLabel: "Sign in to sync scans",
      signInRegisterBtn: "Sign In / Register",
      signInBtn: "Sign In",
      registerBtn: "Create Account",
      signOutBtn: "Sign Out",
      authModalTitle: "Account Workspace",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      passwordMinLabel: "Password (min 8 characters)",
      fullNameLabel: "Full Name",
      farmLocationLabel: "Farm / District Location (Optional)",
      saveProfileBtn: "Save Profile",
      roleUser: "Grower",
      roleAgronomist: "Agronomist",
      roleAdmin: "Administrator",
      statusActive: "Active",
      statusSuspended: "Suspended",

      heroKicker: "Agronomy & Plant Pathology",
      heroTitle: "Plant Disease Detection & Leaf Health Monitoring",
      heroSubtitle:
        "Upload a clear plant leaf photograph to identify foliar conditions, monitor field weather disease risk, and review historical crop metrics.",
      welcomeUploadBtn: "Analyze Plant Leaf",
      refreshDataBtn: "Refresh Data",
      statsErrorTitle: "Unable to load live statistics",
      retryBtn: "Retry",
      statTotalLabel: "Total Scans",
      statHealthyLabel: "Healthy Plants",
      statDiseasedLabel: "Diseased Plants",
      statFieldWeatherLabel: "Field Conditions",
      weatherLoadingShort: "Loading field weather...",
      statWaiting: "Waiting for backend data",
      statUnavailable: "Unavailable",
      statTotalZero: "No scans recorded yet",
      statHealthyZero: "No healthy scans recorded",
      statDiseasedZero: "No diseased scans recorded",
      statTotalActive: "Completed diagnostic evaluations",
      statPctSuffix: "% of total scans",

      recentTitle: "Recent Scan Activity",
      recentSubtitle: "Latest leaf diagnostic evaluations recorded by the server",
      viewAllHistory: "View all history",
      recentEmptyTitle: "No recent scan activity",
      recentEmptyDesc:
        "Upload your first leaf image in the Disease Detection studio to start tracking scans.",
      recentErrorTitle: "Could not load recent activity",
      inspectBtn: "Inspect",
      deleteBtn: "Delete",

      overviewWeatherTitle: "Live Weather & Blight Risk",
      openWeatherDash: "Open Weather Desk",
      weatherHumidity: "Relative Humidity",
      weatherDewPoint: "Dew Point",
      weatherWind: "Wind Speed",
      overallFoliarRisk: "Foliar Disease Pressure",
      viewForecastBtn: "5-Day Forecast",

      detectKicker: "Foliar Specimen Diagnostics",
      detectTitle: "Disease Detection & Analysis",
      detectMeta: "Supported formats: JPG, JPEG, PNG · Max file size: 10 MB",
      uploadPanelTitle: "1. Upload Plant Leaf Image",
      uploadPanelDesc:
        "Choose a well-lit, focused photo of a single leaf against a clean background.",
      dropzoneTitle: "Drag and drop your leaf image here",
      dropzoneSubtitle: "or click to browse from your computer",
      browseBtn: "Browse Image",
      dropzoneHint: "JPG, JPEG, or PNG · Up to 10 MB",
      dropzoneGuidelines: "Single leaf · Natural lighting · Clear focus",
      analyzeBtn: "Analyze Plant",
      changeImageBtn: "Change Image",
      clearBtn: "Clear",
      loadingTitle: "Analyzing Leaf Specimen...",
      loadingSubtitle:
        "Uploading specimen to the server and running disease classification.",

      resultsPanelTitle: "2. Prediction Results",
      resultsPanelDesc:
        "Diagnostic output returned directly from the classification backend.",
      resultsEmptyTitle: "No Prediction Generated Yet",
      resultsEmptyText:
        "Select a leaf image on the left and click Analyze Plant to view real diagnostic results from the backend:",
      checklist1: "Identified plant species and disease condition",
      checklist2: "Model confidence percentage",
      checklist3: "Detailed disease overview and visual symptoms",
      checklist4: "Recommended crop management practices",
      statusHealthy: "Healthy Leaf Detected",
      statusDiseased: "Plant Disease Detected",
      metricPlant: "Predicted Plant",
      metricDisease: "Predicted Disease",
      metricConfidence: "Confidence",
      detailDescription: "Disease Description",
      detailSymptoms: "Observed Symptoms",
      detailRecommendations: "Management Recommendations",
      weatherContextHeading: "Local Weather Field Context",
      scanAnotherBtn: "Scan Another Plant",
      scanIdPrefix: "Scan #",
      fallbackDesc: "No detailed disease description was provided by the backend.",
      fallbackSymptoms: "No specific symptoms listed for this prediction.",
      fallbackRecommendations: "Follow standard crop hygiene and monitoring practices.",

      weatherKicker: "Microclimate & Pathogen Pressure",
      weatherTitle: "Live Weather & Field Risk Desk",
      weatherSearchPlaceholder: "Enter city or district...",
      searchBtn: "Search",
      useGpsBtn: "Use GPS",
      weatherErrorTitle: "Weather Unavailable",
      weatherTempLabel: "Temperature",
      weatherWindRainLabel: "Wind & Rain",
      weatherSprayWindow: "Spray Window",
      pathogenRiskTitle: "Crop Pathogen Susceptibility",
      pathogenRiskDesc:
        "Calculated from live humidity, dew-point spread, precipitation, and canopy temperature.",
      fieldAdvisoryTitle: "Agronomic Field Advisories",
      fieldAdvisoryDesc: "Actionable scouting and foliar care notes for current weather.",
      forecastTitle: "5-Day Field Outlook",
      forecastSubtitle: "Daily temperature bounds, rain volume, and wind velocity",
      colDate: "Date",
      colSkyCondition: "Condition",
      colTempRange: "Low / High",
      colRainProb: "Rain / Prob.",
      colWindMax: "Max Wind",
      riskHigh: "High Risk",
      riskModerate: "Moderate Risk",
      riskLow: "Low Risk",
      sprayOptimal: "Optimal",
      sprayCaution: "Use Caution",
      sprayAvoid: "Avoid Spraying",
      pathogenLateBlight: "Late Blight Pressure",
      pathogenPowderyMildew: "Powdery Mildew Pressure",
      pathogenBacterialSpot: "Bacterial Spot Pressure",
      dewSpreadPrefix: "Dew spread:",
      rainPrefix: "Precip:",
      pressurePrefix: "Pressure:",

      analyticsKicker: "Epidemiology & Quality Metrics",
      analyticsTitle: "Advanced Crop Analytics",
      scopeAll: "All Scans",
      scopeMine: "My Scans",
      exportCsvBtn: "Export CSV",
      anMeanConfidence: "Mean Confidence",
      anMeanConfidenceSub: "Across recorded diagnoses",
      anHealthyRatio: "Healthy Rate",
      anDistinctCrops: "Crop Species",
      anDistinctCropsSub: "Unique plant species evaluated",
      anFlaggedCases: "Flagged for Review",
      anFlaggedSub: "Marked in moderation queue",
      analyticsEmptyTitle: "No Scan Data Yet",
      analyticsEmptyDesc:
        "Analytics charts populate automatically once leaf diagnostic scans are recorded.",
      chartHealthTitle: "Health vs. Diseased Distribution",
      chartHealthDesc: "Proportion of symptom-free foliage vs. identified conditions",
      chartConfidenceTitle: "Confidence Score Distribution",
      chartConfidenceDesc: "Grouping of model certainty tiers across recorded scans",
      chartTimelineTitle: "Daily Scan Volume & Disease Incidence",
      chartTimelineDesc: "Up to 14 most recent active recording dates",
      tableCropsTitle: "Crop Species Breakdown",
      tableCropsDesc: "Healthy vs. diseased counts by species",
      tableDiseasesTitle: "Top Detected Conditions",
      tableDiseasesDesc: "Most frequent diagnoses recorded in the archive",
      colScans: "Scans",
      colAvgConf: "Avg Conf.",
      colCases: "Cases",

      historyKicker: "Diagnostic Archive",
      historyTitle: "Scan History",
      searchPlaceholder: "Search plant or disease...",
      filterAll: "All",
      filterHealthy: "Healthy",
      filterDiseased: "Diseased",
      filterFlagged: "Flagged",
      refreshBtn: "Refresh",
      historyEmptyTitle: "No Scan History Available",
      historyEmptyDesc:
        "Previous leaf diagnoses stored by your backend will appear here once scans are recorded.",
      historyNoMatchTitle: "No Matching Scans Found",
      historyNoMatchDesc:
        "Try clearing your search query or switching the active filter.",
      uploadFirstLeaf: "Upload First Leaf",
      historyErrorTitle: "Failed to Load Scan History",
      retryConnectionBtn: "Retry Connection",
      colLeafImage: "Leaf Image",
      colPlantName: "Plant Name",
      colCondition: "Disease / Condition",
      colConfidence: "Confidence",
      colRecordedBy: "Recorded By",
      colDateTime: "Date & Time",
      colDetails: "Details",

      adminKicker: "Governance & Quality Control",
      adminTitle: "Administration Console",
      adminGateTitle: "Administrator Authentication Required",
      adminGateDesc:
        "Sign in with an administrator account to manage user roles, review flagged plant diagnoses, and inspect audit logs.",
      adminPasscodeLabel: "Administrator Passcode",
      adminPasscodePlaceholder: "Enter server ADMIN_PASSCODE...",
      claimAdminBtn: "Claim Administrator Access",
      adminFirstRunHelp:
        "No administrator account has been configured yet. Claim initial administrator ownership on your signed-in account.",
      adminPasscodeHelp:
        "Enter the server administrator passcode configured in environment secrets to elevate this account.",
      adminLockedHelp:
        "Your account currently has standard permissions. Contact an existing administrator to manage elevated access.",
      admTotalUsers: "Registered Accounts",
      admSystemScans: "Total Scans",
      admFlaggedQueue: "Flagged Reviews",
      admFlaggedSub: "Pending agronomy review",
      admAuditEvents: "Audit Events",
      admAuditSub: "Recorded security & scan logs",
      admTabUsers: "Users & Roles",
      admTabScans: "Scan Moderation",
      admTabAudit: "Audit Log",
      admUsersTitle: "User Directory & Role Management",
      admUsersDesc:
        "Assign user, agronomist, or administrator privileges and manage account access.",
      admUserSearchPlaceholder: "Search name or email...",
      colUser: "User",
      colLocation: "Location",
      colRole: "Role",
      colStatus: "Status",
      colLastLogin: "Last Sign-In",
      colActions: "Actions",
      admScansTitle: "Global Scan Moderation Queue",
      admScansDesc:
        "Flag uncertain diagnoses, attach agronomy notes, or remove invalid submissions.",
      colPlantCondition: "Plant & Condition",
      colSubmitter: "Submitted By",
      colReviewNote: "Agronomy Note",
      admAuditTitle: "Security & Operations Audit Trail",
      admAuditDesc:
        "Chronological ledger of account registrations, authentication events, role updates, and record actions.",
      colEvent: "Event",
      colActor: "Actor",
      colTarget: "Target",
      saveBtn: "Save",
      flagBtn: "Flag",
      unflagBtn: "Unflag",
      flaggedBadge: "Flagged for Review",

      aboutKicker: "System Purpose & Workflow",
      aboutTitle: "About PlantCare",
      objectiveTitle: "Project Objective",
      objectiveP1:
        "Plant diseases pose a major threat to agricultural productivity and food security. Late identification often leads to widespread crop loss or excessive pesticide application.",
      objectiveP2:
        "PlantCare is a plant disease detection and leaf health monitoring platform designed to help growers, agronomists, and students identify foliar conditions early from standard leaf photographs, monitor field weather risk, and apply structured crop care guidance.",
      workflowTitle: "How PlantCare Works",
      step1Title: "Image Acquisition & Validation",
      step1Desc:
        "Upload a JPG, JPEG, or PNG leaf image via drag-and-drop or file selection with format, dimension, and size verification.",
      step2Title: "Foliar Disease Classification",
      step2Desc:
        "The server preprocesses the leaf photograph and evaluates it through a trained vision classification pipeline to identify crop species and foliar disease.",
      step3Title: "Weather Risk & Longitudinal Tracking",
      step3Desc:
        "Diagnostic results, confidence scores, live humidity blight risk, and management recommendations are archived across multi-view dashboards.",

      footerCopy: "PlantCare · Plant Disease Detection and Health Monitoring System",
      modalTitle: "Scan Record Details",
      modalCloseBtn: "Close",
      modalPlantLabel: "Plant Name",
      modalConfidenceLabel: "Confidence",
      modalConditionLabel: "Condition / Disease",
      modalDateLabel: "Scan Date & Time",

      errNoFileTitle: "No File Selected",
      errNoFileMsg: "Please select a plant leaf image.",
      errFormatTitle: "Unsupported File Format",
      errFormatMsg: "Only JPG, JPEG, and PNG leaf images are supported.",
      errEmptyTitle: "Empty File",
      errEmptyMsg: "The selected file appears to be empty. Please choose a valid leaf photo.",
      errSizeTitle: "File Too Large",
      errSizePrefix: "Image exceeds the 10 MB limit",
      errSizeSuffix: "Please upload a smaller image.",
      errDecodeTitle: "Unreadable Image",
      errDecodeMsg: "The selected file could not be decoded as a valid JPG or PNG image.",
      errAnalysisTitle: "Analysis Failed",
      errTimeoutTitle: "Request Timed Out",
      errTimeoutMsg:
        "The analysis took longer than expected. Please try again with a smaller or clearer leaf photo.",
      errNetworkTitle: "Connection Error",
      errNetworkMsg:
        "Could not reach /api/predict. Please ensure the backend server is running and try again.",
      errStatsConn:
        "Unable to connect to the server at /api/stats. Check that the backend is running.",
      errHistoryConn:
        "Unable to connect to the server at /api/history. Start the backend and click Retry.",
      errHtmlBody:
        "The server returned an HTML page instead of a prediction response. Please wait a moment and click Analyze Plant again.",
    },
    hi: {
      pageTitle: "प्लांटकेयर — पौधों के रोग की पहचान और स्वास्थ्य निगरानी",
      brandName: "प्लांटकेयर",
      navGroupWorkspace: "कार्यक्षेत्र",
      navGroupSystem: "संचालन",
      navOverview: "ओवरव्यू डैशबोर्ड",
      navDetect: "रोग जांच",
      navWeather: "लाइव मौसम",
      navAnalytics: "विश्लेषण (Analytics)",
      navHistory: "स्कैन इतिहास",
      navAdmin: "एडमिन कंसोल",
      navAbout: "परिचय",
      headerScanBtn: "पत्ती स्कैन करें",
      languageLabel: "भाषा चुनें",
      guestUserLabel: "अतिथि कार्यक्षेत्र",
      guestRoleLabel: "स्कैन सिंक करने के लिए साइन इन करें",
      signInRegisterBtn: "साइन इन / पंजीकरण",
      signInBtn: "साइन इन",
      registerBtn: "नया खाता बनाएं",
      signOutBtn: "साइन आउट",
      authModalTitle: "खाता कार्यक्षेत्र",
      emailLabel: "ईमेल पता",
      passwordLabel: "पासवर्ड",
      passwordMinLabel: "पासवर्ड (कम से कम 8 अक्षर)",
      fullNameLabel: "पूरा नाम",
      farmLocationLabel: "खेत / जिला स्थान (वैकल्पिक)",
      saveProfileBtn: "प्रोफ़ाइल सहेजें",
      roleUser: "किसान / उपयोगकर्ता",
      roleAgronomist: "कृषि विशेषज्ञ",
      roleAdmin: "प्रशासक (Admin)",
      statusActive: "सक्रिय",
      statusSuspended: "निलंबित",

      heroKicker: "कृषि विज्ञान और पादप रोग निदान",
      heroTitle: "पौधों के रोग की पहचान और पत्ती स्वास्थ्य निगरानी",
      heroSubtitle:
        "पत्ती की साफ तस्वीर अपलोड करें, खेत के मौसम से रोग का जोखिम देखें, और सभी फसल स्कैन आंकड़ों की समीक्षा करें।",
      welcomeUploadBtn: "पौधे की पत्ती जांचें",
      refreshDataBtn: "डेटा रीफ्रेश करें",
      statsErrorTitle: "लाइव आंकड़े लोड नहीं हो सके",
      retryBtn: "पुनः प्रयास करें",
      statTotalLabel: "कुल स्कैन",
      statHealthyLabel: "स्वस्थ पौधे",
      statDiseasedLabel: "रोगग्रस्त पौधे",
      statFieldWeatherLabel: "खेत का मौसम",
      weatherLoadingShort: "मौसम डेटा लोड हो रहा है...",
      statWaiting: "सर्वर डेटा की प्रतीक्षा है",
      statUnavailable: "उपलब्ध नहीं",
      statTotalZero: "अभी कोई स्कैन दर्ज नहीं है",
      statHealthyZero: "कोई स्वस्थ स्कैन दर्ज नहीं है",
      statDiseasedZero: "कोई रोगग्रस्त स्कैन दर्ज नहीं है",
      statTotalActive: "पूर्ण किए गए निदान परीक्षण",
      statPctSuffix: "% कुल स्कैन का",

      recentTitle: "हालिया स्कैन गतिविधि",
      recentSubtitle: "सर्वर द्वारा दर्ज की गई नवीनतम पत्ती जांच रिपोर्ट",
      viewAllHistory: "पूरा इतिहास देखें",
      recentEmptyTitle: "कोई हालिया स्कैन गतिविधि नहीं",
      recentEmptyDesc:
        "स्कैन ट्रैक करना शुरू करने के लिए रोग जांच अनुभाग में अपनी पहली पत्ती की तस्वीर अपलोड करें।",
      recentErrorTitle: "हालिया गतिविधि लोड नहीं हो सकी",
      inspectBtn: "विवरण देखें",
      deleteBtn: "हटाएं",

      overviewWeatherTitle: "लाइव मौसम और रोग जोखिम",
      openWeatherDash: "मौसम डेस्क खोलें",
      weatherHumidity: "सापेक्ष आर्द्रता (नमी)",
      weatherDewPoint: "ओस बिंदु (Dew Point)",
      weatherWind: "हवा की गति",
      overallFoliarRisk: "पत्ती रोग दबाव",
      viewForecastBtn: "5-दिवसीय पूर्वानुमान",

      detectKicker: "पत्ती नमूना परीक्षण",
      detectTitle: "रोग पहचान और विश्लेषण",
      detectMeta: "समर्थित प्रारूप: JPG, JPEG, PNG · अधिकतम आकार: 10 MB",
      uploadPanelTitle: "1. पौधे की पत्ती की तस्वीर अपलोड करें",
      uploadPanelDesc:
        "साफ पृष्ठभूमि में अच्छी रोशनी वाली एक पत्ती की स्पष्ट फोटो चुनें।",
      dropzoneTitle: "अपनी पत्ती की तस्वीर यहाँ खींचकर छोड़ें",
      dropzoneSubtitle: "या अपने डिवाइस से फ़ाइल चुनने के लिए क्लिक करें",
      browseBtn: "तस्वीर चुनें",
      dropzoneHint: "JPG, JPEG, या PNG · अधिकतम 10 MB",
      dropzoneGuidelines: "एकल पत्ती · प्राकृतिक रोशनी · स्पष्ट फोकस",
      analyzeBtn: "पौधे की जांच करें",
      changeImageBtn: "तस्वीर बदलें",
      clearBtn: "हटाएं",
      loadingTitle: "पत्ती के नमूने की जांच हो रही है...",
      loadingSubtitle:
        "तस्वीर सर्वर पर भेजी जा रही है और रोग वर्गीकरण किया जा रहा है।",

      resultsPanelTitle: "2. जांच के परिणाम",
      resultsPanelDesc:
        "वर्गीकरण बैकएंड से प्राप्त वास्तविक निदान विवरण।",
      resultsEmptyTitle: "अभी कोई परिणाम तैयार नहीं है",
      resultsEmptyText:
        "बैकएंड से वास्तविक निदान परिणाम देखने के लिए बाईं ओर पत्ती की तस्वीर चुनें और 'पौधे की जांच करें' पर क्लिक करें:",
      checklist1: "पहचाने गए पौधे की प्रजाति और रोग का नाम",
      checklist2: "मॉडल का विश्वास प्रतिशत (Confidence)",
      checklist3: "रोग का विस्तृत विवरण और मुख्य लक्षण",
      checklist4: "उचित फसल प्रबंधन और देखभाल के सुझाव",
      statusHealthy: "स्वस्थ पत्ती पाई गई",
      statusDiseased: "पौधे में रोग पाया गया",
      metricPlant: "पहचाना गया पौधा",
      metricDisease: "पहचाना गया रोग",
      metricConfidence: "विश्वास स्तर",
      detailDescription: "रोग का विवरण",
      detailSymptoms: "देखे गए लक्षण",
      detailRecommendations: "फसल प्रबंधन सुझाव",
      weatherContextHeading: "स्थानीय मौसम खेत संदर्भ",
      scanAnotherBtn: "दूसरा पौधा स्कैन करें",
      scanIdPrefix: "स्कैन #",
      fallbackDesc: "बैकएंड द्वारा रोग का विस्तृत विवरण प्रदान नहीं किया गया।",
      fallbackSymptoms: "इस जांच के लिए कोई विशिष्ट लक्षण सूचीबद्ध नहीं हैं।",
      fallbackRecommendations: "नियमित फसल स्वच्छता और निगरानी उपायों का पालन करें।",

      weatherKicker: "सूक्ष्म जलवायु और रोगजनक दबाव",
      weatherTitle: "लाइव मौसम और खेत जोखिम डेस्क",
      weatherSearchPlaceholder: "शहर या जिला दर्ज करें...",
      searchBtn: "खोजें",
      useGpsBtn: "GPS उपयोग करें",
      weatherErrorTitle: "मौसम उपलब्ध नहीं",
      weatherTempLabel: "तापमान",
      weatherWindRainLabel: "हवा और बारिश",
      weatherSprayWindow: "छिड़काव समय",
      pathogenRiskTitle: "फसल रोग संवेदनशीलता",
      pathogenRiskDesc: "लाइव नमी, ओस बिंदु अंतर, बारिश और तापमान से गणना।",
      fieldAdvisoryTitle: "कृषि क्षेत्र सलाह",
      fieldAdvisoryDesc: "वर्तमान मौसम के अनुसार निगरानी और पत्ती देखभाल निर्देश।",
      forecastTitle: "5-दिवसीय खेत मौसम पूर्वानुमान",
      forecastSubtitle: "दैनिक न्यूनतम/अधिकतम तापमान, वर्षा और हवा की गति",
      colDate: "दिनांक",
      colSkyCondition: "मौसम स्थिति",
      colTempRange: "न्यूनतम / अधिकतम",
      colRainProb: "वर्षा / संभावना",
      colWindMax: "अधिकतम हवा",
      riskHigh: "उच्च जोखिम",
      riskModerate: "मध्यम जोखिम",
      riskLow: "कम जोखिम",
      sprayOptimal: "उपयुक्त समय",
      sprayCaution: "सावधानी बरतें",
      sprayAvoid: "छिड़काव से बचें",
      pathogenLateBlight: "लेट ब्लाइट (पछेती झुलसा) दबाव",
      pathogenPowderyMildew: "चूर्णिल आसिता (Powdery Mildew) दबाव",
      pathogenBacterialSpot: "जीवाणु धब्बा दबाव",
      dewSpreadPrefix: "ओस अंतर:",
      rainPrefix: "वर्षा:",
      pressurePrefix: "दाब:",

      analyticsKicker: "रोग विज्ञान और गुणवत्ता मेट्रिक्स",
      analyticsTitle: "उन्नत फसल विश्लेषण",
      scopeAll: "सभी स्कैन",
      scopeMine: "मेरे स्कैन",
      exportCsvBtn: "CSV निर्यात करें",
      anMeanConfidence: "औसत विश्वास स्तर",
      anMeanConfidenceSub: "दर्ज किए गए सभी निदानों में",
      anHealthyRatio: "स्वस्थ दर",
      anDistinctCrops: "फसल प्रजातियां",
      anDistinctCropsSub: "जांची गई विभिन्न पौधों की प्रजातियां",
      anFlaggedCases: "समीक्षा के लिए चिह्नित",
      anFlaggedSub: "मॉडरेशन कतार में चिह्नित",
      analyticsEmptyTitle: "अभी कोई स्कैन डेटा नहीं",
      analyticsEmptyDesc:
        "पत्ती निदान स्कैन दर्ज होने के बाद विश्लेषण चार्ट अपने आप दिखाई देंगे।",
      chartHealthTitle: "स्वस्थ बनाम रोगग्रस्त वितरण",
      chartHealthDesc: "लक्षण-रहित पत्तियों और पहचाने गए रोगों का अनुपात",
      chartConfidenceTitle: "विश्वास स्तर वितरण",
      chartConfidenceDesc: "मॉडल निश्चितता स्तरों का वर्गीकरण",
      chartTimelineTitle: "दैनिक स्कैन और रोग प्रवृत्ति",
      chartTimelineDesc: "नवीनतम 14 सक्रिय रिकॉर्डिंग तिथियां",
      tableCropsTitle: "फसल प्रजाति विवरण",
      tableCropsDesc: "प्रजाति के अनुसार स्वस्थ और रोगग्रस्त संख्या",
      tableDiseasesTitle: "प्रमुख पहचानी गई स्थितियां",
      tableDiseasesDesc: "अभिलेख में सबसे अधिक दर्ज किए गए निदान",
      colScans: "स्कैन",
      colAvgConf: "औसत विश्वास",
      colCases: "मामले",

      historyKicker: "निदान अभिलेख",
      historyTitle: "स्कैन इतिहास",
      searchPlaceholder: "पौधा या रोग खोजें...",
      filterAll: "सभी",
      filterHealthy: "स्वस्थ",
      filterDiseased: "रोगग्रस्त",
      filterFlagged: "चिह्नित",
      refreshBtn: "रीफ्रेश",
      historyEmptyTitle: "कोई स्कैन इतिहास उपलब्ध नहीं है",
      historyEmptyDesc:
        "स्कैन दर्ज होने के बाद आपके बैकएंड में सहेजे गए पिछले निदान यहाँ दिखाई देंगे।",
      historyNoMatchTitle: "कोई मेल खाने वाला स्कैन नहीं मिला",
      historyNoMatchDesc:
        "अपनी खोज शब्द साफ करें या फ़िल्टर बदलकर देखें।",
      uploadFirstLeaf: "पहली पत्ती अपलोड करें",
      historyErrorTitle: "स्कैन इतिहास लोड करने में विफल",
      retryConnectionBtn: "पुनः कनेक्ट करें",
      colLeafImage: "पत्ती की तस्वीर",
      colPlantName: "पौधे का नाम",
      colCondition: "रोग / स्थिति",
      colConfidence: "विश्वास स्तर",
      colRecordedBy: "द्वारा दर्ज",
      colDateTime: "दिनांक और समय",
      colDetails: "विवरण",

      adminKicker: "शासन और गुणवत्ता नियंत्रण",
      adminTitle: "प्रशासन कंसोल",
      adminGateTitle: "प्रशासक प्रमाणीकरण आवश्यक",
      adminGateDesc:
        "उपयोगकर्ता भूमिकाएं प्रबंधित करने, चिह्नित निदान की समीक्षा करने और ऑडिट लॉग देखने के लिए प्रशासक खाते से साइन इन करें।",
      adminPasscodeLabel: "प्रशासक पासकोड",
      adminPasscodePlaceholder: "सर्वर ADMIN_PASSCODE दर्ज करें...",
      claimAdminBtn: "प्रशासक अधिकार प्राप्त करें",
      adminFirstRunHelp:
        "अभी तक कोई प्रशासक खाता सेट नहीं है। अपने साइन-इन किए गए खाते पर प्रारंभिक प्रशासक स्वामित्व प्राप्त करें।",
      adminPasscodeHelp:
        "इस खाते को प्रशासक भूमिका देने के लिए सर्वर प्रशासक पासकोड दर्ज करें।",
      adminLockedHelp:
        "आपके खाते के पास वर्तमान में मानक अनुमतियां हैं। उच्च अधिकार के लिए मौजूदा प्रशासक से संपर्क करें।",
      admTotalUsers: "पंजीकृत खाते",
      admSystemScans: "कुल स्कैन",
      admFlaggedQueue: "चिह्नित समीक्षाएं",
      admFlaggedSub: "कृषि समीक्षा प्रतीक्षित",
      admAuditEvents: "ऑडिट घटनाएं",
      admAuditSub: "सुरक्षा एवं संचालन लॉग",
      admTabUsers: "उपयोगकर्ता और भूमिकाएं",
      admTabScans: "स्कैन मॉडरेशन",
      admTabAudit: "ऑडिट लॉग",
      admUsersTitle: "उपयोगकर्ता निर्देशिका और भूमिका प्रबंधन",
      admUsersDesc:
        "उपयोगकर्ता, कृषि विशेषज्ञ या प्रशासक भूमिकाएं निर्धारित करें और खाता पहुंच प्रबंधित करें।",
      admUserSearchPlaceholder: "नाम या ईमेल खोजें...",
      colUser: "उपयोगकर्ता",
      colLocation: "स्थान",
      colRole: "भूमिका",
      colStatus: "स्थिति",
      colLastLogin: "अंतिम साइन-इन",
      colActions: "कार्रवाई",
      admScansTitle: "वैश्विक स्कैन मॉडरेशन कतार",
      admScansDesc:
        "अनिश्चित निदान को चिह्नित करें, कृषि नोट जोड़ें, या अमान्य प्रविष्टियां हटाएं।",
      colPlantCondition: "पौधा और स्थिति",
      colSubmitter: "द्वारा प्रस्तुत",
      colReviewNote: "कृषि नोट",
      admAuditTitle: "सुरक्षा एवं संचालन ऑडिट लॉग",
      admAuditDesc:
        "खाता पंजीकरण, लॉगिन गतिविधि, भूमिका परिवर्तन और रिकॉर्ड कार्रवाइयों का विवरण।",
      colEvent: "घटना",
      colActor: "कर्ता",
      colTarget: "लक्ष्य",
      saveBtn: "सहेजें",
      flagBtn: "चिह्नित करें",
      unflagBtn: "चिह्न हटाएं",
      flaggedBadge: "समीक्षा के लिए चिह्नित",

      aboutKicker: "प्रणाली उद्देश्य और कार्यप्रणाली",
      aboutTitle: "प्लांटकेयर के बारे में",
      objectiveTitle: "परियोजना का उद्देश्य",
      objectiveP1:
        "पौधों के रोग कृषि उत्पादकता और खाद्य सुरक्षा के लिए बड़ा खतरा हैं। देर से पहचान होने पर फसल को भारी नुकसान या अत्यधिक कीटनाशक उपयोग की समस्या आती है।",
      objectiveP2:
        "प्लांटकेयर एक पादप रोग पहचान और पत्ती स्वास्थ्य निगरानी प्रणाली है, जो किसानों, कृषि विशेषज्ञों और छात्रों को सामान्य पत्तियों की तस्वीरों से शुरुआती लक्षण पहचानने, मौसम जोखिम जांचने और सही फसल देखभाल अपनाने में मदद करती है।",
      workflowTitle: "प्लांटकेयर कैसे काम करता है",
      step1Title: "तस्वीर अपलोड और सत्यापन",
      step1Desc:
        "ड्रैग-एंड-ड्रॉप या फाइल चयन द्वारा JPG, JPEG या PNG पत्ती की तस्वीर अपलोड करें, जिसमें प्रारूप और आकार की जांच शामिल है।",
      step2Title: "पत्ती रोग वर्गीकरण",
      step2Desc:
        "सर्वर तस्वीर को प्रोसेस करता है और प्रशिक्षित विज़न वर्गीकरण पाइपलाइन द्वारा पौधे और रोग की पहचान करता है।",
      step3Title: "मौसम जोखिम और दीर्घकालिक ट्रैकिंग",
      step3Desc:
        "निदान परिणाम, विश्वास प्रतिशत, लाइव नमी रोग जोखिम और प्रबंधन सुझाव बहु-डैशबोर्ड कार्यक्षेत्र में सुरक्षित रखे जाते हैं।",

      footerCopy: "प्लांटकेयर · पौधों के रोग की पहचान और स्वास्थ्य निगरानी प्रणाली",
      modalTitle: "स्कैन रिकॉर्ड विवरण",
      modalCloseBtn: "बंद करें",
      modalPlantLabel: "पौधे का नाम",
      modalConfidenceLabel: "विश्वास स्तर",
      modalConditionLabel: "स्थिति / रोग",
      modalDateLabel: "स्कैन दिनांक और समय",

      errNoFileTitle: "कोई फ़ाइल नहीं चुनी गई",
      errNoFileMsg: "कृपया पौधे की पत्ती की एक तस्वीर चुनें।",
      errFormatTitle: "असमर्थित फ़ाइल प्रारूप",
      errFormatMsg: "केवल JPG, JPEG और PNG पत्तियों की तस्वीरें समर्थित हैं।",
      errEmptyTitle: "खाली फ़ाइल",
      errEmptyMsg: "चुनी गई फ़ाइल खाली प्रतीत होती है। कृपया एक मान्य पत्ती की तस्वीर चुनें।",
      errSizeTitle: "फ़ाइल बहुत बड़ी है",
      errSizePrefix: "तस्वीर 10 MB की सीमा से अधिक है",
      errSizeSuffix: "कृपया छोटी तस्वीर अपलोड करें।",
      errDecodeTitle: "अमान्य तस्वीर",
      errDecodeMsg: "चुनी गई फ़ाइल को वैध JPG या PNG तस्वीर के रूप में पढ़ा नहीं जा सका।",
      errAnalysisTitle: "विश्लेषण विफल",
      errTimeoutTitle: "अनुरोध समय समाप्त",
      errTimeoutMsg:
        "जांच में अपेक्षा से अधिक समय लगा। कृपया छोटी या अधिक स्पष्ट पत्ती की तस्वीर के साथ पुनः प्रयास करें।",
      errNetworkTitle: "कनेक्शन त्रुटि",
      errNetworkMsg:
        "/api/predict से संपर्क नहीं हो सका। कृपया सुनिश्चित करें कि बैकएंड सर्वर चल रहा है।",
      errStatsConn:
        "/api/stats पर सर्वर से कनेक्ट नहीं हो सका। जांचें कि बैकएंड चल रहा है।",
      errHistoryConn:
        "/api/history पर सर्वर से कनेक्ट नहीं हो सका। बैकएंड शुरू करें और पुनः प्रयास करें।",
      errHtmlBody:
        "सर्वर ने निदान JSON के बजाय HTML पृष्ठ लौटाया। कृपया कुछ सेकंड प्रतीक्षा करें और पुनः 'पौधे की जांच करें' दबाएं।",
    },
  };

  function loadInitialLanguage() {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === "hi" || saved === "en") return saved;
    } catch {
      // Ignore storage access restrictions
    }
    return "en";
  }

  /* ------------------------------------------------------------------------
     In-Memory Application State (Tokens NEVER saved to web storage)
     ------------------------------------------------------------------------ */
  const state = {
    language: loadInitialLanguage(),
    activeView: "overview",
    authToken: null,
    currentUser: null,
    bootstrapStatus: { admin_exists: true, passcode_configured: false, total_users: 0 },

    selectedFile: null,
    previewObjectUrl: null,
    isAnalyzing: false,
    lastStats: null,
    lastPrediction: null,

    historyItems: [],
    historyFilter: "all",
    historyScope: "all",
    historyQuery: "",

    analyticsScope: "all",
    lastAnalytics: null,

    weatherQuery: { city: "", lat: null, lon: null },
    lastWeather: null,

    adminTab: "users",
    adminScanFilter: "all",
    adminUsers: [],
    adminScans: [],
    adminAuditLogs: [],
    adminUserSearch: "",
  };

  function t(key) {
    const dict = TRANSLATIONS[state.language] || TRANSLATIONS.en;
    return dict[key] !== undefined ? dict[key] : TRANSLATIONS.en[key] || "";
  }

  /* ------------------------------------------------------------------------
     DOM References
     ------------------------------------------------------------------------ */
  const el = {
    sidebar: document.getElementById("app-sidebar"),
    sidebarBackdrop: document.getElementById("sidebar-backdrop"),
    sidebarCloseBtn: document.getElementById("sidebar-close-btn"),
    mobileMenuToggle: document.getElementById("mobile-menu-toggle"),
    sidebarLinks: document.querySelectorAll(".sidebar-link[data-view]"),
    viewPanels: document.querySelectorAll(".workspace-view[data-view-panel]"),
    topbarViewTitle: document.getElementById("topbar-view-title"),
    languageSelect: document.getElementById("language-select"),

    // Account UI
    sidebarAvatar: document.getElementById("sidebar-avatar"),
    sidebarUserName: document.getElementById("sidebar-user-name"),
    sidebarUserRole: document.getElementById("sidebar-user-role"),
    sidebarAuthBtn: document.getElementById("sidebar-auth-btn"),
    sidebarLogoutBtn: document.getElementById("sidebar-logout-btn"),
    topbarAccountBtn: document.getElementById("topbar-account-btn"),
    topbarAccountLabel: document.getElementById("topbar-account-label"),

    // Auth Modal
    authModalBackdrop: document.getElementById("auth-modal-backdrop"),
    authModalCloseBtn: document.getElementById("auth-modal-close-btn"),
    authGuestPanel: document.getElementById("auth-guest-panel"),
    authProfilePanel: document.getElementById("auth-profile-panel"),
    authTabButtons: document.querySelectorAll("[data-auth-tab]"),
    authErrorBanner: document.getElementById("auth-error-banner"),
    authErrorMessage: document.getElementById("auth-error-message"),
    loginForm: document.getElementById("login-form"),
    loginEmail: document.getElementById("login-email"),
    loginPassword: document.getElementById("login-password"),
    registerForm: document.getElementById("register-form"),
    regName: document.getElementById("reg-name"),
    regEmail: document.getElementById("reg-email"),
    regLocation: document.getElementById("reg-location"),
    regPassword: document.getElementById("reg-password"),
    profileSummaryName: document.getElementById("profile-summary-name"),
    profileSummaryEmail: document.getElementById("profile-summary-email"),
    profileSummaryRole: document.getElementById("profile-summary-role"),
    profileErrorBanner: document.getElementById("profile-error-banner"),
    profileErrorMessage: document.getElementById("profile-error-message"),
    profileForm: document.getElementById("profile-form"),
    profileNameInput: document.getElementById("profile-name-input"),
    profileLocationInput: document.getElementById("profile-location-input"),
    profileOpenAdminBtn: document.getElementById("profile-open-admin-btn"),
    profileLogoutBtn: document.getElementById("profile-logout-btn"),

    // Overview & Stats
    refreshDashboardBtn: document.getElementById("refresh-dashboard-btn"),
    statsErrorBanner: document.getElementById("stats-error-banner"),
    statsErrorMessage: document.getElementById("stats-error-message"),
    retryStatsBtn: document.getElementById("retry-stats-btn"),
    statTotalScans: document.getElementById("stat-total-scans"),
    statTotalCaption: document.getElementById("stat-total-caption"),
    statHealthyPlants: document.getElementById("stat-healthy-plants"),
    statHealthyCaption: document.getElementById("stat-healthy-caption"),
    statDiseasedPlants: document.getElementById("stat-diseased-plants"),
    statDiseasedCaption: document.getElementById("stat-diseased-caption"),
    overviewWeatherTemp: document.getElementById("overview-weather-temp"),
    overviewWeatherCaption: document.getElementById("overview-weather-caption"),
    overviewWeatherLocation: document.getElementById("overview-weather-location"),
    overviewWeatherLoading: document.getElementById("overview-weather-loading"),
    overviewWeatherBody: document.getElementById("overview-weather-body"),
    ovHumidity: document.getElementById("ov-humidity"),
    ovDewpoint: document.getElementById("ov-dewpoint"),
    ovWind: document.getElementById("ov-wind"),
    ovRiskLevel: document.getElementById("ov-risk-level"),
    ovRiskAdvisory: document.getElementById("ov-risk-advisory"),

    // Recent Activity
    recentLoading: document.getElementById("recent-loading"),
    recentEmpty: document.getElementById("recent-empty"),
    recentError: document.getElementById("recent-error"),
    recentErrorMessage: document.getElementById("recent-error-message"),
    retryRecentBtn: document.getElementById("retry-recent-btn"),
    recentActivityList: document.getElementById("recent-activity-list"),

    // Detect Lab
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("leaf-file-input"),
    browseBtn: document.getElementById("browse-btn"),
    previewContainer: document.getElementById("preview-container"),
    previewImage: document.getElementById("preview-image"),
    previewFilename: document.getElementById("preview-filename"),
    previewFilesize: document.getElementById("preview-filesize"),
    previewDimensions: document.getElementById("preview-dimensions"),
    analyzeBtn: document.getElementById("analyze-btn"),
    changeImageBtn: document.getElementById("change-image-btn"),
    clearImageBtn: document.getElementById("clear-image-btn"),
    uploadError: document.getElementById("upload-error"),
    uploadErrorTitle: document.getElementById("upload-error-title"),
    uploadErrorMessage: document.getElementById("upload-error-message"),
    analysisLoading: document.getElementById("analysis-loading"),
    resultsEmpty: document.getElementById("results-empty"),
    resultsContent: document.getElementById("results-content"),
    resultStatusIndicator: document.getElementById("result-status-indicator"),
    resultStatusIcon: document.getElementById("result-status-icon"),
    resultStatusLabel: document.getElementById("result-status-label"),
    resultScanId: document.getElementById("result-scan-id"),
    resultPlantImage: document.getElementById("result-plant-image"),
    resultPlantName: document.getElementById("result-plant-name"),
    resultDiseaseName: document.getElementById("result-disease-name"),
    resultConfidence: document.getElementById("result-confidence"),
    resultConfidenceBarTrack: document.getElementById("result-confidence-bar-track"),
    resultConfidenceBar: document.getElementById("result-confidence-bar"),
    resultDescription: document.getElementById("result-description"),
    resultSymptoms: document.getElementById("result-symptoms"),
    resultRecommendations: document.getElementById("result-recommendations"),
    detectWeatherContext: document.getElementById("detect-weather-context"),
    detectWeatherContextText: document.getElementById("detect-weather-context-text"),
    scanAnotherBtn: document.getElementById("scan-another-btn"),

    // Weather View
    weatherSearchForm: document.getElementById("weather-search-form"),
    weatherCityInput: document.getElementById("weather-city-input"),
    weatherGeoBtn: document.getElementById("weather-geo-btn"),
    weatherErrorBanner: document.getElementById("weather-error-banner"),
    weatherErrorMessage: document.getElementById("weather-error-message"),
    weatherLocName: document.getElementById("weather-loc-name"),
    weatherLocCoords: document.getElementById("weather-loc-coords"),
    weatherObservedAt: document.getElementById("weather-observed-at"),
    wTemp: document.getElementById("w-temp"),
    wCondition: document.getElementById("w-condition"),
    wHumidity: document.getElementById("w-humidity"),
    wDewpoint: document.getElementById("w-dewpoint"),
    wWind: document.getElementById("w-wind"),
    wPrecip: document.getElementById("w-precip"),
    wSprayWindow: document.getElementById("w-spray-window"),
    wPressure: document.getElementById("w-pressure"),
    weatherRiskBars: document.getElementById("weather-risk-bars"),
    weatherAdvisoriesList: document.getElementById("weather-advisories-list"),
    weatherForecastBody: document.getElementById("weather-forecast-body"),

    // Analytics View
    analyticsScopeButtons: document.querySelectorAll("[data-analytics-scope]"),
    exportCsvBtn: document.getElementById("export-csv-btn"),
    refreshAnalyticsBtn: document.getElementById("refresh-analytics-btn"),
    anAvgConf: document.getElementById("an-avg-conf"),
    anHealthyRate: document.getElementById("an-healthy-rate"),
    anTotalSub: document.getElementById("an-total-sub"),
    anDistinctCrops: document.getElementById("an-distinct-crops"),
    anFlaggedCount: document.getElementById("an-flagged-count"),
    analyticsEmptyState: document.getElementById("analytics-empty-state"),
    analyticsChartsArea: document.getElementById("analytics-charts-area"),
    chartHealthDonut: document.getElementById("chart-health-donut"),
    chartConfidenceBars: document.getElementById("chart-confidence-bars"),
    chartDailySeries: document.getElementById("chart-daily-series"),
    analyticsCropsBody: document.getElementById("analytics-crops-body"),
    analyticsDiseasesBody: document.getElementById("analytics-diseases-body"),

    // History View
    historySearch: document.getElementById("history-search"),
    filterButtons: document.querySelectorAll(".segmented-btn[data-filter]"),
    historyScopeButtons: document.querySelectorAll("[data-history-scope]"),
    refreshHistoryBtn: document.getElementById("refresh-history-btn"),
    historyLoading: document.getElementById("history-loading"),
    historyEmpty: document.getElementById("history-empty"),
    historyEmptyTitle: document.getElementById("history-empty-title"),
    historyEmptyDesc: document.getElementById("history-empty-desc"),
    historyEmptyCta: document.getElementById("history-empty-cta"),
    historyError: document.getElementById("history-error"),
    historyErrorMessage: document.getElementById("history-error-message"),
    retryHistoryBtn: document.getElementById("retry-history-btn"),
    historyTableWrapper: document.getElementById("history-table-wrapper"),
    historyTableBody: document.getElementById("history-table-body"),

    // Admin View
    adminHeaderActions: document.getElementById("admin-header-actions"),
    adminRefreshBtn: document.getElementById("admin-refresh-btn"),
    adminAccessGate: document.getElementById("admin-access-gate"),
    adminGateTitle: document.getElementById("admin-gate-title"),
    adminGateDesc: document.getElementById("admin-gate-desc"),
    adminGateGuestActions: document.getElementById("admin-gate-guest-actions"),
    adminOpenLoginBtn: document.getElementById("admin-open-login-btn"),
    adminOpenRegisterBtn: document.getElementById("admin-open-register-btn"),
    adminClaimForm: document.getElementById("admin-claim-form"),
    adminClaimHelp: document.getElementById("admin-claim-help"),
    adminPasscodeRow: document.getElementById("admin-passcode-row"),
    adminClaimPasscode: document.getElementById("admin-claim-passcode"),
    adminClaimError: document.getElementById("admin-claim-error"),
    adminClaimErrorMsg: document.getElementById("admin-claim-error-msg"),
    adminWorkspace: document.getElementById("admin-workspace"),
    admTotalUsers: document.getElementById("adm-total-users"),
    admActiveUsersSub: document.getElementById("adm-active-users-sub"),
    admTotalScans: document.getElementById("adm-total-scans"),
    admDiseaseRateSub: document.getElementById("adm-disease-rate-sub"),
    admFlaggedScans: document.getElementById("adm-flagged-scans"),
    admAuditCount: document.getElementById("adm-audit-count"),
    adminTabButtons: document.querySelectorAll("[data-admin-tab]"),
    adminTabUsers: document.getElementById("admin-tab-users"),
    adminTabScans: document.getElementById("admin-tab-scans"),
    adminTabAudit: document.getElementById("admin-tab-audit"),
    adminUserSearch: document.getElementById("admin-user-search"),
    adminUsersBody: document.getElementById("admin-users-body"),
    adminScanFilterButtons: document.querySelectorAll("[data-admin-scan-filter]"),
    adminScansBody: document.getElementById("admin-scans-body"),
    adminAuditBody: document.getElementById("admin-audit-body"),

    // Scan Detail Modal
    modalBackdrop: document.getElementById("scan-modal-backdrop"),
    modalBody: document.getElementById("modal-body"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    modalDismissBtn: document.getElementById("modal-dismiss-btn"),
  };

  const ICONS = {
    healthy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    diseased:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    leafFallback:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
  };

  /* ------------------------------------------------------------------------
     Utility Helpers
     ------------------------------------------------------------------------ */
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isHealthyCondition(diseaseName) {
    if (!diseaseName) return false;
    const normalized = String(diseaseName).toLowerCase();
    return normalized.includes("healthy") || normalized.includes("स्वस्थ");
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatConfidence(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${Math.max(0, Math.min(100, num)).toFixed(1)}%`;
  }

  function roleLabel(role) {
    if (role === "admin") return t("roleAdmin");
    if (role === "agronomist") return t("roleAgronomist");
    return t("roleUser");
  }

  function authHeaders(extra = {}) {
    const headers = { Accept: "application/json", ...extra };
    if (state.authToken) {
      headers.Authorization = `Bearer ${state.authToken}`;
    }
    return headers;
  }

  async function parseApiResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!text) return { data: null, contentType, text: "" };
    try {
      return { data: JSON.parse(text), contentType, text };
    } catch {
      return { data: null, contentType, text };
    }
  }

  function createThumbnailHtml(imageUrl, altText) {
    const safeAlt = escapeHtml(altText || "Plant leaf thumbnail");
    if (!imageUrl) {
      return `<div class="scan-thumb"><span class="scan-thumb-fallback" aria-hidden="true">${ICONS.leafFallback}</span></div>`;
    }
    const safeUrl = escapeHtml(imageUrl);
    return `
      <div class="scan-thumb">
        <img
          src="${safeUrl}"
          alt="${safeAlt}"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"
        />
        <span class="scan-thumb-fallback" style="display:none;" aria-hidden="true">${ICONS.leafFallback}</span>
      </div>
    `;
  }

  /* ------------------------------------------------------------------------
     Multi-Dashboard View Switching & Sidebar Navigation
     ------------------------------------------------------------------------ */
  function viewTitleKey(view) {
    const map = {
      overview: "navOverview",
      detect: "navDetect",
      weather: "navWeather",
      analytics: "navAnalytics",
      history: "navHistory",
      admin: "navAdmin",
      about: "navAbout",
    };
    return map[view] || "navOverview";
  }

  function closeSidebarMobile() {
    el.sidebar.classList.remove("is-open");
    el.sidebarBackdrop.hidden = true;
    el.mobileMenuToggle.setAttribute("aria-expanded", "false");
  }

  function switchView(viewName) {
    const target = VALID_VIEWS.includes(viewName) ? viewName : "overview";
    state.activeView = target;

    el.viewPanels.forEach((panel) => {
      panel.hidden = panel.getAttribute("data-view-panel") !== target;
    });

    el.sidebarLinks.forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === target);
    });

    el.topbarViewTitle.textContent = t(viewTitleKey(target));
    closeSidebarMobile();

    if (window.location.hash !== `#${target}`) {
      window.history.replaceState(null, "", `#${target}`);
    }

    if (target === "analytics") {
      fetchAnalytics();
    } else if (target === "weather") {
      fetchWeather();
    } else if (target === "admin") {
      renderAdminView();
    } else if (target === "history") {
      fetchScanHistory();
    }
  }

  function initNavigation() {
    el.sidebarLinks.forEach((btn) => {
      btn.addEventListener("click", () => {
        switchView(btn.getAttribute("data-view"));
      });
    });

    document.addEventListener("click", (event) => {
      const goTrigger = event.target.closest("[data-go-view]");
      if (goTrigger) {
        event.preventDefault();
        switchView(goTrigger.getAttribute("data-go-view"));
      }
      const brandTrigger = event.target.closest("[data-view-link]");
      if (brandTrigger) {
        event.preventDefault();
        switchView(brandTrigger.getAttribute("data-view-link"));
      }
    });

    el.mobileMenuToggle.addEventListener("click", () => {
      el.sidebar.classList.add("is-open");
      el.sidebarBackdrop.hidden = false;
      el.mobileMenuToggle.setAttribute("aria-expanded", "true");
    });

    el.sidebarCloseBtn.addEventListener("click", closeSidebarMobile);
    el.sidebarBackdrop.addEventListener("click", closeSidebarMobile);

    const hashView = window.location.hash.replace("#", "").trim();
    if (VALID_VIEWS.includes(hashView)) {
      switchView(hashView);
    } else {
      switchView("overview");
    }
  }

  /* ------------------------------------------------------------------------
     Language Switcher
     ------------------------------------------------------------------------ */
  function applyLanguage(lang) {
    const normalized = lang === "hi" ? "hi" : "en";
    state.language = normalized;
    document.documentElement.lang = normalized;
    document.title = t("pageTitle");

    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage errors
    }

    if (el.languageSelect && el.languageSelect.value !== normalized) {
      el.languageSelect.value = normalized;
    }

    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key) node.textContent = t(key);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const key = node.getAttribute("data-i18n-placeholder");
      if (key) node.setAttribute("placeholder", t(key));
    });

    el.topbarViewTitle.textContent = t(viewTitleKey(state.activeView));
    renderAccountChrome();

    if (state.lastStats) renderStats(state.lastStats);
    if (state.lastPrediction) renderPredictionResult(state.lastPrediction);
    if (state.historyItems.length > 0 || !el.historyEmpty.hidden) {
      renderRecentActivity(state.historyItems);
      renderHistoryTable();
    }
    if (state.lastAnalytics) renderAnalytics(state.lastAnalytics);
    fetchWeather();
    if (state.activeView === "admin") renderAdminView();
  }

  /* ------------------------------------------------------------------------
     User Registration, Authentication & Profile
     ------------------------------------------------------------------------ */
  function renderAccountChrome() {
    const user = state.currentUser;
    if (user) {
      const initials = (user.full_name || user.email || "U").trim().charAt(0).toUpperCase();
      el.sidebarAvatar.textContent = initials;
      el.sidebarUserName.textContent = user.full_name;
      el.sidebarUserRole.textContent = `${roleLabel(user.role)}${user.farm_location ? ` · ${user.farm_location}` : ""}`;
      el.sidebarAuthBtn.textContent = t("authModalTitle");
      el.sidebarLogoutBtn.hidden = false;
      el.topbarAccountLabel.textContent = user.full_name;
    } else {
      el.sidebarAvatar.textContent = "G";
      el.sidebarUserName.textContent = t("guestUserLabel");
      el.sidebarUserRole.textContent = t("guestRoleLabel");
      el.sidebarAuthBtn.textContent = t("signInRegisterBtn");
      el.sidebarLogoutBtn.hidden = true;
      el.topbarAccountLabel.textContent = t("signInBtn");
    }
  }

  function setAuthTab(tabName) {
    const isLogin = tabName !== "register";
    el.authTabButtons.forEach((btn) => {
      const active = btn.getAttribute("data-auth-tab") === (isLogin ? "login" : "register");
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    el.loginForm.hidden = !isLogin;
    el.registerForm.hidden = isLogin;
    el.authErrorBanner.hidden = true;
  }

  function openAuthModal(defaultTab = "login") {
    el.authErrorBanner.hidden = true;
    el.profileErrorBanner.hidden = true;

    if (state.currentUser) {
      el.authGuestPanel.hidden = true;
      el.authProfilePanel.hidden = false;
      el.profileSummaryName.textContent = state.currentUser.full_name;
      el.profileSummaryEmail.textContent = state.currentUser.email;
      el.profileSummaryRole.textContent = roleLabel(state.currentUser.role);
      el.profileNameInput.value = state.currentUser.full_name || "";
      el.profileLocationInput.value = state.currentUser.farm_location || "";
    } else {
      el.authGuestPanel.hidden = false;
      el.authProfilePanel.hidden = true;
      setAuthTab(defaultTab);
    }

    el.authModalBackdrop.hidden = false;
  }

  function closeAuthModal() {
    el.authModalBackdrop.hidden = true;
  }

  async function refreshBootstrapStatus() {
    try {
      const resp = await fetch(API_ENDPOINTS.AUTH_STATUS, { headers: { Accept: "application/json" } });
      const { data } = await parseApiResponse(resp);
      if (resp.ok && data && data.success) {
        state.bootstrapStatus = {
          admin_exists: Boolean(data.admin_exists),
          passcode_configured: Boolean(data.passcode_configured),
          total_users: Number(data.total_users || 0),
        };
      }
    } catch {
      // Ignore transient bootstrap check error
    }
  }

  function applyAuthenticatedSession(token, user, adminExists) {
    state.authToken = token;
    state.currentUser = user;
    if (typeof adminExists === "boolean") {
      state.bootstrapStatus.admin_exists = adminExists;
    }
    renderAccountChrome();
    closeAuthModal();

    if (user && user.farm_location && !state.weatherQuery.city) {
      state.weatherQuery = { city: user.farm_location, lat: null, lon: null };
      fetchWeather();
    }
    fetchScanHistory();
    if (state.activeView === "admin") {
      renderAdminView();
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    el.authErrorBanner.hidden = true;
    try {
      const resp = await fetch(API_ENDPOINTS.AUTH_LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: el.loginEmail.value.trim(),
          password: el.loginPassword.value,
        }),
      });
      const { data } = await parseApiResponse(resp);
      if (!resp.ok || !data || !data.success) {
        el.authErrorMessage.textContent = (data && data.error) || "Sign in failed.";
        el.authErrorBanner.hidden = false;
        return;
      }
      el.loginPassword.value = "";
      applyAuthenticatedSession(data.token, data.user, data.admin_exists);
    } catch {
      el.authErrorMessage.textContent = "Unable to connect to authentication service.";
      el.authErrorBanner.hidden = false;
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    el.authErrorBanner.hidden = true;
    try {
      const resp = await fetch(API_ENDPOINTS.AUTH_REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          full_name: el.regName.value.trim(),
          email: el.regEmail.value.trim(),
          farm_location: el.regLocation.value.trim(),
          password: el.regPassword.value,
        }),
      });
      const { data } = await parseApiResponse(resp);
      if (!resp.ok || !data || !data.success) {
        el.authErrorMessage.textContent = (data && data.error) || "Registration failed.";
        el.authErrorBanner.hidden = false;
        return;
      }
      el.regPassword.value = "";
      applyAuthenticatedSession(data.token, data.user, data.admin_exists);
    } catch {
      el.authErrorMessage.textContent = "Unable to connect to registration service.";
      el.authErrorBanner.hidden = false;
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    el.profileErrorBanner.hidden = true;
    try {
      const resp = await fetch(API_ENDPOINTS.AUTH_PROFILE, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          full_name: el.profileNameInput.value.trim(),
          farm_location: el.profileLocationInput.value.trim(),
        }),
      });
      const { data } = await parseApiResponse(resp);
      if (!resp.ok || !data || !data.success) {
        el.profileErrorMessage.textContent = (data && data.error) || "Failed to update profile.";
        el.profileErrorBanner.hidden = false;
        return;
      }
      state.currentUser = data.user;
      renderAccountChrome();
      el.profileSummaryName.textContent = data.user.full_name;
      closeAuthModal();
    } catch {
      el.profileErrorMessage.textContent = "Network error while updating profile.";
      el.profileErrorBanner.hidden = false;
    }
  }

  async function logoutUser() {
    if (state.authToken) {
      try {
        await fetch(API_ENDPOINTS.AUTH_LOGOUT, {
          method: "POST",
          headers: authHeaders(),
        });
      } catch {
        // Ignore network errors during logout cleanup
      }
    }
    state.authToken = null;
    state.currentUser = null;
    state.historyScope = "all";
    state.analyticsScope = "all";
    renderAccountChrome();
    closeAuthModal();
    fetchScanHistory();
    if (state.activeView === "admin") {
      renderAdminView();
    }
  }

  /* ------------------------------------------------------------------------
     Overview Statistics (/api/stats)
     ------------------------------------------------------------------------ */
  function renderStatsUnavailable(message) {
    state.lastStats = null;
    el.statTotalScans.textContent = "—";
    el.statHealthyPlants.textContent = "—";
    el.statDiseasedPlants.textContent = "—";
    el.statTotalCaption.textContent = t("statUnavailable");
    el.statHealthyCaption.textContent = t("statUnavailable");
    el.statDiseasedCaption.textContent = t("statUnavailable");
    el.statsErrorMessage.textContent = message || t("errStatsConn");
    el.statsErrorBanner.hidden = false;
  }

  function renderStats(data) {
    state.lastStats = data;
    const total = Number(data.total_scans ?? 0);
    const healthy = Number(data.healthy_plants ?? 0);
    const diseased = Number(data.diseased_plants ?? 0);

    el.statsErrorBanner.hidden = true;
    el.statTotalScans.textContent = Number.isFinite(total) ? total.toLocaleString() : "0";
    el.statHealthyPlants.textContent = Number.isFinite(healthy) ? healthy.toLocaleString() : "0";
    el.statDiseasedPlants.textContent = Number.isFinite(diseased) ? diseased.toLocaleString() : "0";

    if (total === 0) {
      el.statTotalCaption.textContent = t("statTotalZero");
      el.statHealthyCaption.textContent = t("statHealthyZero");
      el.statDiseasedCaption.textContent = t("statDiseasedZero");
    } else {
      el.statTotalCaption.textContent = t("statTotalActive");
      el.statHealthyCaption.textContent = `${((healthy / total) * 100).toFixed(1)}${t("statPctSuffix")}`;
      el.statDiseasedCaption.textContent = `${((diseased / total) * 100).toFixed(1)}${t("statPctSuffix")}`;
    }
  }

  async function fetchDashboardStats() {
    el.statsErrorBanner.hidden = true;
    try {
      const response = await fetch(API_ENDPOINTS.STATS, { headers: authHeaders() });
      const { data } = await parseApiResponse(response);
      if (!response.ok || !data || data.success !== true) {
        renderStatsUnavailable((data && data.error) || `HTTP ${response.status}`);
        return;
      }
      renderStats(data);
    } catch {
      renderStatsUnavailable(t("errStatsConn"));
    }
  }

  /* ------------------------------------------------------------------------
     Live Weather & Agronomic Risk (/api/weather)
     ------------------------------------------------------------------------ */
  function riskLevelText(level) {
    if (level === "high") return t("riskHigh");
    if (level === "moderate") return t("riskModerate");
    return t("riskLow");
  }

  function sprayLabelText(windowCode) {
    if (windowCode === "avoid") return t("sprayAvoid");
    if (windowCode === "caution") return t("sprayCaution");
    return t("sprayOptimal");
  }

  function pathogenLabel(key) {
    if (key === "late_blight") return t("pathogenLateBlight");
    if (key === "powdery_mildew") return t("pathogenPowderyMildew");
    return t("pathogenBacterialSpot");
  }

  function renderWeather(data) {
    state.lastWeather = data;
    const loc = data.location || {};
    const cur = data.current || {};
    const risk = data.agronomy_risk || {};
    const forecast = Array.isArray(data.forecast) ? data.forecast : [];

    el.weatherErrorBanner.hidden = true;

    // Overview snapshot
    el.overviewWeatherTemp.textContent = `${Number(cur.temperature_c ?? 0).toFixed(1)}°C`;
    el.overviewWeatherCaption.textContent = `${cur.condition || "—"} · ${loc.name || ""}`;
    el.overviewWeatherLocation.textContent = loc.name || "—";
    el.overviewWeatherLoading.hidden = true;
    el.overviewWeatherBody.hidden = false;
    el.ovHumidity.textContent = `${Number(cur.humidity_pct ?? 0).toFixed(0)}%`;
    el.ovDewpoint.textContent = `${Number(cur.dew_point_c ?? 0).toFixed(1)}°C`;
    el.ovWind.textContent = `${Number(cur.wind_speed_kmh ?? 0).toFixed(1)} km/h`;
    el.ovRiskLevel.textContent = riskLevelText(risk.overall_risk);
    el.ovRiskLevel.className = `risk-text is-${risk.overall_risk || "low"}`;
    el.ovRiskAdvisory.textContent = (risk.advisories && risk.advisories[0]) || "";

    // Weather desk
    el.weatherLocName.textContent = loc.name || "—";
    el.weatherLocCoords.textContent = `${Number(loc.latitude || 0).toFixed(2)}°, ${Number(loc.longitude || 0).toFixed(2)}°`;
    el.weatherObservedAt.textContent = String(cur.observed_at || "").replace("T", " ");

    el.wTemp.textContent = `${Number(cur.temperature_c ?? 0).toFixed(1)}°C`;
    el.wCondition.textContent = cur.condition || "—";
    el.wHumidity.textContent = `${Number(cur.humidity_pct ?? 0).toFixed(0)}%`;
    el.wDewpoint.textContent = `${t("dewSpreadPrefix")} ${Number(risk.dew_spread_c ?? 0).toFixed(1)}°C`;
    el.wWind.textContent = `${Number(cur.wind_speed_kmh ?? 0).toFixed(1)} km/h`;
    el.wPrecip.textContent = `${t("rainPrefix")} ${Number(cur.precipitation_mm ?? 0).toFixed(1)} mm`;
    el.wSprayWindow.textContent = sprayLabelText(risk.spray_window);
    el.wPressure.textContent = `${t("pressurePrefix")} ${Number(cur.pressure_hpa ?? 1013).toFixed(0)} hPa`;

    const diseases = Array.isArray(risk.diseases) ? risk.diseases : [];
    el.weatherRiskBars.innerHTML = diseases
      .map((item) => {
        const cls =
          item.level === "high" ? "is-diseased" : item.level === "moderate" ? "is-warning" : "is-healthy";
        return `
          <div class="risk-bar-item">
            <div class="risk-bar-head">
              <span class="risk-bar-name">${escapeHtml(pathogenLabel(item.key))}</span>
              <span class="tabular-nums">${escapeHtml(riskLevelText(item.level))} (${Number(item.score)}/100)</span>
            </div>
            <div class="confidence-track">
              <div class="confidence-fill ${cls}" style="width: ${Math.min(100, Math.max(0, Number(item.score)))}%"></div>
            </div>
          </div>
        `;
      })
      .join("");

    const advisories = Array.isArray(risk.advisories) ? risk.advisories : [];
    el.weatherAdvisoriesList.innerHTML = advisories
      .map((note) => `<li>${escapeHtml(note)}</li>`)
      .join("");

    el.weatherForecastBody.innerHTML = forecast
      .map(
        (day) => `
          <tr>
            <td class="tabular-nums"><strong>${escapeHtml(day.date)}</strong></td>
            <td>${escapeHtml(day.condition)}</td>
            <td class="text-right tabular-nums">${Number(day.temp_min_c).toFixed(1)}° / ${Number(day.temp_max_c).toFixed(1)}°C</td>
            <td class="text-right tabular-nums">${Number(day.precip_mm).toFixed(1)} mm (${Number(day.precip_prob).toFixed(0)}%)</td>
            <td class="text-right tabular-nums">${Number(day.wind_max_kmh).toFixed(1)} km/h</td>
          </tr>
        `
      )
      .join("");

    // Refresh weather context banner in Detect view if a prediction is active
    if (state.lastPrediction) {
      updateDetectWeatherContext();
    }
  }

  async function fetchWeather() {
    const params = new URLSearchParams({ lang: state.language });
    if (state.weatherQuery.city) {
      params.set("city", state.weatherQuery.city);
    } else if (state.weatherQuery.lat !== null && state.weatherQuery.lon !== null) {
      params.set("lat", String(state.weatherQuery.lat));
      params.set("lon", String(state.weatherQuery.lon));
    }

    try {
      const resp = await fetch(`${API_ENDPOINTS.WEATHER}?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const { data } = await parseApiResponse(resp);
      if (!resp.ok || !data || !data.success) {
        el.weatherErrorMessage.textContent = (data && data.error) || "Weather request failed.";
        el.weatherErrorBanner.hidden = false;
        el.overviewWeatherLoading.hidden = true;
        el.overviewWeatherTemp.textContent = "—";
        el.overviewWeatherCaption.textContent = t("weatherErrorTitle");
        return;
      }
      renderWeather(data);
    } catch {
      el.weatherErrorMessage.textContent = "Unable to connect to /api/weather.";
      el.weatherErrorBanner.hidden = false;
      el.overviewWeatherLoading.hidden = true;
    }
  }

  function updateDetectWeatherContext() {
    if (!state.lastWeather || !el.detectWeatherContext) return;
    const cur = state.lastWeather.current || {};
    const risk = state.lastWeather.agronomy_risk || {};
    const loc = state.lastWeather.location || {};
    const msg =
      state.language === "hi"
        ? `${loc.name || "वर्तमान स्थान"}: ${Number(cur.temperature_c ?? 0).toFixed(1)}°C, नमी ${Number(cur.humidity_pct ?? 0).toFixed(0)}% — ${(risk.advisories && risk.advisories[0]) || ""}`
        : `${loc.name || "Field location"}: ${Number(cur.temperature_c ?? 0).toFixed(1)}°C, ${Number(cur.humidity_pct ?? 0).toFixed(0)}% RH — ${(risk.advisories && risk.advisories[0]) || ""}`;
    el.detectWeatherContextText.textContent = msg;
    el.detectWeatherContext.hidden = false;
  }

  /* ------------------------------------------------------------------------
     Advanced Analytics (/api/analytics + SVG Charts)
     ------------------------------------------------------------------------ */
  function renderDonutChart(summary) {
    const healthy = Number(summary.healthy_count || 0);
    const diseased = Number(summary.diseased_count || 0);
    const total = Math.max(1, healthy + diseased);
    const radius = 56;
    const circ = 2 * Math.PI * radius;
    const healthyDash = (healthy / total) * circ;
    const diseasedDash = (diseased / total) * circ;

    el.chartHealthDonut.innerHTML = `
      <div class="svg-donut-layout">
        <svg width="152" height="152" viewBox="0 0 152 152" role="img" aria-label="Healthy vs Diseased Donut Chart">
          <circle cx="76" cy="76" r="${radius}" fill="none" stroke="#e0e7e2" stroke-width="18"></circle>
          <circle cx="76" cy="76" r="${radius}" fill="none" stroke="#15803d" stroke-width="18"
            stroke-dasharray="${healthyDash} ${circ}" transform="rotate(-90 76 76)"></circle>
          <circle cx="76" cy="76" r="${radius}" fill="none" stroke="#b91c1c" stroke-width="18"
            stroke-dasharray="${diseasedDash} ${circ}" stroke-dashoffset="-${healthyDash}" transform="rotate(-90 76 76)"></circle>
          <text x="76" y="72" text-anchor="middle" font-size="20" font-weight="700" fill="#0f1f17">${Number(summary.healthy_rate || 0).toFixed(0)}%</text>
          <text x="76" y="90" text-anchor="middle" font-size="11" fill="#64748b">${escapeHtml(t("filterHealthy"))}</text>
        </svg>
        <div class="svg-legend">
          <div class="svg-legend-row">
            <span class="legend-label-pair"><span class="legend-swatch" style="background:#15803d"></span>${escapeHtml(t("filterHealthy"))}</span>
            <strong class="tabular-nums">${healthy}</strong>
          </div>
          <div class="svg-legend-row">
            <span class="legend-label-pair"><span class="legend-swatch" style="background:#b91c1c"></span>${escapeHtml(t("filterDiseased"))}</span>
            <strong class="tabular-nums">${diseased}</strong>
          </div>
          <div class="svg-legend-row">
            <span class="legend-label-pair">${escapeHtml(t("statTotalLabel"))}</span>
            <strong class="tabular-nums">${summary.total_scans || 0}</strong>
          </div>
        </div>
      </div>
    `;
  }

  function renderDailySeriesSvg(series) {
    if (!Array.isArray(series) || series.length === 0) {
      el.chartDailySeries.innerHTML = `<p class="detail-text">${escapeHtml(t("analyticsEmptyTitle"))}</p>`;
      return;
    }

    const maxTotal = Math.max(1, ...series.map((d) => Number(d.total || 0)));
    const barW = 34;
    const gap = 18;
    const padLeft = 34;
    const chartH = 140;
    const svgW = Math.max(360, padLeft + series.length * (barW + gap) + 20);

    const barsSvg = series
      .map((day, idx) => {
        const x = padLeft + idx * (barW + gap);
        const hHealthy = Math.round((Number(day.healthy || 0) / maxTotal) * chartH);
        const hDiseased = Math.round((Number(day.diseased || 0) / maxTotal) * chartH);
        const yDiseased = chartH - hDiseased + 16;
        const yHealthy = yDiseased - hHealthy;
        const shortDate = String(day.date || "").slice(5);

        return `
          <g>
            <rect x="${x}" y="${yHealthy}" width="${barW}" height="${hHealthy}" rx="3" fill="#15803d"></rect>
            <rect x="${x}" y="${yDiseased}" width="${barW}" height="${hDiseased}" rx="3" fill="#b91c1c"></rect>
            <text x="${x + barW / 2}" y="${chartH + 34}" text-anchor="middle" font-size="11" fill="#64748b">${escapeHtml(shortDate)}</text>
            <text x="${x + barW / 2}" y="${Math.max(12, yHealthy - 5)}" text-anchor="middle" font-size="11" font-weight="600" fill="#0f1f17">${Number(day.total || 0)}</text>
          </g>
        `;
      })
      .join("");

    el.chartDailySeries.innerHTML = `
      <svg viewBox="0 0 ${svgW} ${chartH + 46}" width="100%" height="190" role="img" aria-label="Daily Scan Volume Chart">
        <line x1="${padLeft - 8}" y1="${chartH + 16}" x2="${svgW - 10}" y2="${chartH + 16}" stroke="#e0e7e2" stroke-width="1"></line>
        ${barsSvg}
      </svg>
    `;
  }

  function renderAnalytics(data) {
    state.lastAnalytics = data;
    const summary = data.summary || {};
    const total = Number(summary.total_scans || 0);

    el.anAvgConf.textContent = total > 0 ? `${Number(summary.avg_confidence || 0).toFixed(1)}%` : "—";
    el.anHealthyRate.textContent = total > 0 ? `${Number(summary.healthy_rate || 0).toFixed(1)}%` : "—";
    el.anTotalSub.textContent = `${summary.healthy_count || 0} / ${total}`;
    el.anDistinctCrops.textContent = String(summary.distinct_crops || 0);
    el.anFlaggedCount.textContent = String(summary.flagged_count || 0);

    if (total === 0) {
      el.analyticsEmptyState.hidden = false;
      el.analyticsChartsArea.hidden = true;
      return;
    }

    el.analyticsEmptyState.hidden = true;
    el.analyticsChartsArea.hidden = false;

    renderDonutChart(summary);

    const dist = Array.isArray(data.confidence_distribution) ? data.confidence_distribution : [];
    el.chartConfidenceBars.innerHTML = dist
      .map((bucket) => {
        const pct = total > 0 ? (Number(bucket.count || 0) / total) * 100 : 0;
        const cls = bucket.key === "high" ? "is-healthy" : bucket.key === "mid" ? "is-warning" : "is-diseased";
        return `
          <div class="risk-bar-item">
            <div class="risk-bar-head">
              <span class="risk-bar-name tabular-nums">${escapeHtml(bucket.label)}</span>
              <span class="tabular-nums">${Number(bucket.count || 0)} (${pct.toFixed(1)}%)</span>
            </div>
            <div class="confidence-track">
              <div class="confidence-fill ${cls}" style="width: ${pct.toFixed(1)}%"></div>
            </div>
          </div>
        `;
      })
      .join("");

    renderDailySeriesSvg(data.daily_series || []);

    const crops = Array.isArray(data.crop_breakdown) ? data.crop_breakdown : [];
    el.analyticsCropsBody.innerHTML = crops
      .map(
        (c) => `
          <tr>
            <td><strong>${escapeHtml(c.plant)}</strong></td>
            <td class="text-right tabular-nums">${c.total}</td>
            <td class="text-right tabular-nums">${c.healthy}</td>
            <td class="text-right tabular-nums">${c.diseased}</td>
            <td class="text-right tabular-nums">${Number(c.avg_confidence).toFixed(1)}%</td>
          </tr>
        `
      )
      .join("");

    const diseases = Array.isArray(data.disease_breakdown) ? data.disease_breakdown : [];
    el.analyticsDiseasesBody.innerHTML = diseases
      .map(
        (d) => `
          <tr>
            <td><span class="condition-cell ${d.is_healthy ? "is-healthy" : "is-diseased"}">${escapeHtml(d.disease)}</span></td>
            <td>${escapeHtml(d.plant)}</td>
            <td class="text-right tabular-nums">${d.count}</td>
            <td class="text-right tabular-nums">${Number(d.avg_confidence).toFixed(1)}%</td>
          </tr>
        `
      )
      .join("");
  }

  async function fetchAnalytics() {
    if (state.analyticsScope === "mine" && !state.currentUser) {
      state.analyticsScope = "all";
      el.analyticsScopeButtons.forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-analytics-scope") === "all");
      });
    }
    try {
      const resp = await fetch(`${API_ENDPOINTS.ANALYTICS}?scope=${encodeURIComponent(state.analyticsScope)}`, {
        headers: authHeaders(),
      });
      const { data } = await parseApiResponse(resp);
      if (resp.ok && data && data.success) {
        renderAnalytics(data);
      }
    } catch {
      // Retain previous render if unavailable
    }
  }

  function exportHistoryCsv() {
    const items = state.historyItems || [];
    if (items.length === 0) return;
    const headers = ["ID", "Plant", "Disease", "Confidence (%)", "Recorded By", "Flagged", "Created At"];
    const rows = items.map((item) => [
      item.id,
      item.plant,
      item.disease,
      item.confidence,
      item.user_name || "Guest",
      item.flagged ? "Yes" : "No",
      item.created_at,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `plantcare_scans_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------------
     Scan History & Recent Activity (/api/history)
     ------------------------------------------------------------------------ */
  function setHistoryState(view) {
    el.historyLoading.hidden = view !== "loading";
    el.historyEmpty.hidden = view !== "empty";
    el.historyError.hidden = view !== "error";
    el.historyTableWrapper.hidden = view !== "table";
  }

  function setRecentState(view) {
    el.recentLoading.hidden = view !== "loading";
    el.recentEmpty.hidden = view !== "empty";
    el.recentError.hidden = view !== "error";
    el.recentActivityList.hidden = view !== "list";
  }

  function renderRecentActivity(items) {
    if (!Array.isArray(items) || items.length === 0) {
      el.recentActivityList.innerHTML = "";
      setRecentState("empty");
      return;
    }

    const inspectLabel = escapeHtml(t("inspectBtn"));
    const recentSlice = items.slice(0, 5);
    el.recentActivityList.innerHTML = recentSlice
      .map((item) => {
        const healthy = isHealthyCondition(item.disease);
        const statusClass = healthy ? "is-healthy" : "is-diseased";
        const statusIcon = healthy ? ICONS.healthy : ICONS.diseased;
        const plant = escapeHtml(item.plant || "Unknown Plant");
        const disease = escapeHtml(item.disease || "Unknown Condition");
        const createdAt = escapeHtml(item.created_at || "—");
        const confidence = formatConfidence(item.confidence);

        return `
          <li class="recent-item">
            <div class="recent-item-main">
              ${createThumbnailHtml(item.image_url, `${plant} - ${disease}`)}
              <div class="recent-item-info">
                <span class="recent-item-title">${plant}</span>
                <div class="recent-item-meta">
                  <span class="condition-cell ${statusClass}">
                    <span class="condition-icon" aria-hidden="true">${statusIcon}</span>
                    <span>${disease}</span>
                  </span>
                  <span aria-hidden="true">&middot;</span>
                  <span class="tabular-nums">${createdAt}</span>
                </div>
              </div>
            </div>
            <div class="recent-item-right">
              <span class="recent-confidence tabular-nums">${confidence}</span>
              <button type="button" class="btn btn-ghost btn-sm" data-inspect-id="${escapeHtml(item.id)}">
                ${inspectLabel}
              </button>
            </div>
          </li>
        `;
      })
      .join("");

    setRecentState("list");
  }

  function getFilteredHistory() {
    const query = state.historyQuery.trim().toLowerCase();
    return state.historyItems.filter((item) => {
      const healthy = isHealthyCondition(item.disease);
      if (state.historyFilter === "healthy" && !healthy) return false;
      if (state.historyFilter === "diseased" && healthy) return false;

      if (query) {
        const plantMatch = String(item.plant || "").toLowerCase().includes(query);
        const diseaseMatch = String(item.disease || "").toLowerCase().includes(query);
        return plantMatch || diseaseMatch;
      }
      return true;
    });
  }

  function renderHistoryTable() {
    if (!Array.isArray(state.historyItems) || state.historyItems.length === 0) {
      el.historyEmptyTitle.textContent = t("historyEmptyTitle");
      el.historyEmptyDesc.textContent = t("historyEmptyDesc");
      el.historyEmptyCta.hidden = false;
      el.historyTableBody.innerHTML = "";
      setHistoryState("empty");
      return;
    }

    const filtered = getFilteredHistory();
    if (filtered.length === 0) {
      el.historyEmptyTitle.textContent = t("historyNoMatchTitle");
      el.historyEmptyDesc.textContent = t("historyNoMatchDesc");
      el.historyEmptyCta.hidden = true;
      el.historyTableBody.innerHTML = "";
      setHistoryState("empty");
      return;
    }

    const inspectLabel = escapeHtml(t("inspectBtn"));
    const deleteLabel = escapeHtml(t("deleteBtn"));
    el.historyTableBody.innerHTML = filtered
      .map((item) => {
        const healthy = isHealthyCondition(item.disease);
        const statusClass = healthy ? "is-healthy" : "is-diseased";
        const statusIcon = healthy ? ICONS.healthy : ICONS.diseased;
        const plant = escapeHtml(item.plant || "Unknown Plant");
        const disease = escapeHtml(item.disease || "Unknown Condition");
        const createdAt = escapeHtml(item.created_at || "—");
        const confidence = formatConfidence(item.confidence);
        const recorder = escapeHtml(item.user_name || "Field Grower");
        const flaggedHtml = item.flagged
          ? `<span class="flagged-note-label">${escapeHtml(t("flaggedBadge"))}</span>`
          : "";
        const deleteBtn = item.can_delete
          ? `<button type="button" class="btn btn-danger-ghost btn-xs" data-delete-scan-id="${escapeHtml(item.id)}">${deleteLabel}</button>`
          : "";

        return `
          <tr>
            <td>${createThumbnailHtml(item.image_url, `${plant} leaf`)}</td>
            <td><strong>${plant}</strong></td>
            <td>
              <span class="condition-cell ${statusClass}">
                <span class="condition-icon" aria-hidden="true">${statusIcon}</span>
                <span>${disease}</span>
              </span>
              ${flaggedHtml}
            </td>
            <td class="text-right tabular-nums">${confidence}</td>
            <td>${recorder}</td>
            <td class="tabular-nums">${createdAt}</td>
            <td class="text-right">
              <div class="table-actions-cell">
                <button type="button" class="btn btn-secondary btn-xs" data-inspect-id="${escapeHtml(item.id)}">${inspectLabel}</button>
                ${deleteBtn}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    setHistoryState("table");
  }

  async function fetchScanHistory() {
    if (state.historyScope === "mine" && !state.currentUser) {
      state.historyScope = "all";
      el.historyScopeButtons.forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-history-scope") === "all");
      });
    }

    setHistoryState("loading");
    setRecentState("loading");

    try {
      const response = await fetch(
        `${API_ENDPOINTS.HISTORY}?scope=${encodeURIComponent(state.historyScope)}`,
        { headers: authHeaders() }
      );
      const { data } = await parseApiResponse(response);

      if (!response.ok || !data || data.success !== true || !Array.isArray(data.history)) {
        const msg = (data && data.error) || `Unexpected response (HTTP ${response.status})`;
        el.historyErrorMessage.textContent = msg;
        el.recentErrorMessage.textContent = msg;
        setHistoryState("error");
        setRecentState("error");
        return;
      }

      state.historyItems = data.history;
      renderRecentActivity(state.historyItems);
      renderHistoryTable();
    } catch {
      const networkMsg = t("errHistoryConn");
      el.historyErrorMessage.textContent = networkMsg;
      el.recentErrorMessage.textContent = networkMsg;
      setHistoryState("error");
      setRecentState("error");
    }
  }

  async function deleteHistoryScan(scanId) {
    try {
      const resp = await fetch(`${API_ENDPOINTS.HISTORY}/${encodeURIComponent(scanId)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (resp.ok) {
        fetchDashboardStats();
        fetchScanHistory();
        if (state.activeView === "analytics") fetchAnalytics();
        if (state.activeView === "admin") loadAdminData();
      }
    } catch {
      // Ignore transient network failure
    }
  }

  /* ------------------------------------------------------------------------
     Admin Console (Users, Roles, Scan Moderation, Audit Log)
     ------------------------------------------------------------------------ */
  function setAdminTab(tab) {
    state.adminTab = tab;
    el.adminTabButtons.forEach((btn) => {
      const active = btn.getAttribute("data-admin-tab") === tab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    el.adminTabUsers.hidden = tab !== "users";
    el.adminTabScans.hidden = tab !== "scans";
    el.adminTabAudit.hidden = tab !== "audit";
  }

  function renderAdminUsers() {
    const query = state.adminUserSearch.trim().toLowerCase();
    const list = state.adminUsers.filter((u) => {
      if (!query) return true;
      return (
        String(u.full_name || "").toLowerCase().includes(query) ||
        String(u.email || "").toLowerCase().includes(query)
      );
    });

    const saveText = escapeHtml(t("saveBtn"));
    el.adminUsersBody.innerHTML = list
      .map(
        (u) => `
        <tr>
          <td>
            <strong>${escapeHtml(u.full_name)}</strong>
            <div class="stat-caption">${escapeHtml(u.email)}</div>
          </td>
          <td>${escapeHtml(u.farm_location || "—")}</td>
          <td class="text-right tabular-nums">${Number(u.scan_count || 0)}</td>
          <td>
            <select class="inline-select" data-admin-role-select="${escapeHtml(u.id)}">
              <option value="user" ${u.role === "user" ? "selected" : ""}>${escapeHtml(t("roleUser"))}</option>
              <option value="agronomist" ${u.role === "agronomist" ? "selected" : ""}>${escapeHtml(t("roleAgronomist"))}</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>${escapeHtml(t("roleAdmin"))}</option>
            </select>
          </td>
          <td>
            <select class="inline-select" data-admin-status-select="${escapeHtml(u.id)}">
              <option value="active" ${u.status === "active" ? "selected" : ""}>${escapeHtml(t("statusActive"))}</option>
              <option value="suspended" ${u.status === "suspended" ? "selected" : ""}>${escapeHtml(t("statusSuspended"))}</option>
            </select>
          </td>
          <td class="tabular-nums">${escapeHtml(u.last_login_at || "—")}</td>
          <td class="text-right">
            <button type="button" class="btn btn-secondary btn-xs" data-admin-save-user="${escapeHtml(u.id)}">${saveText}</button>
          </td>
        </tr>
      `
      )
      .join("");
  }

  function renderAdminScans() {
    const filtered = state.adminScans.filter((s) =>
      state.adminScanFilter === "flagged" ? Boolean(s.flagged) : true
    );
    const saveText = escapeHtml(t("saveBtn"));
    const deleteText = escapeHtml(t("deleteBtn"));

    el.adminScansBody.innerHTML = filtered
      .map((s) => {
        const flagText = escapeHtml(s.flagged ? t("unflagBtn") : t("flagBtn"));
        return `
          <tr>
            <td>${createThumbnailHtml(s.image_url, s.plant)}</td>
            <td>
              <strong>${escapeHtml(s.plant)}</strong>
              <div class="condition-cell ${isHealthyCondition(s.disease) ? "is-healthy" : "is-diseased"}">${escapeHtml(s.disease)}</div>
              ${s.flagged ? `<span class="flagged-note-label">${escapeHtml(t("flaggedBadge"))}</span>` : ""}
            </td>
            <td>
              <div>${escapeHtml(s.user_name || "Guest")}</div>
              <div class="stat-caption">${escapeHtml(s.user_email || "—")}</div>
            </td>
            <td class="text-right tabular-nums">${formatConfidence(s.confidence)}</td>
            <td>
              <input type="text" class="text-input inline-note-input" data-admin-note-input="${escapeHtml(s.id)}" value="${escapeHtml(s.review_note || "")}" maxlength="300" />
            </td>
            <td class="text-right">
              <div class="table-actions-cell">
                <button type="button" class="btn btn-secondary btn-xs" data-admin-flag-scan="${escapeHtml(s.id)}" data-next-flagged="${s.flagged ? "false" : "true"}">${flagText}</button>
                <button type="button" class="btn btn-secondary btn-xs" data-admin-save-note="${escapeHtml(s.id)}">${saveText}</button>
                <button type="button" class="btn btn-danger-ghost btn-xs" data-admin-delete-scan="${escapeHtml(s.id)}">${deleteText}</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderAdminAudit() {
    el.adminAuditBody.innerHTML = state.adminAuditLogs
      .map(
        (log) => `
          <tr>
            <td class="tabular-nums">${escapeHtml(log.created_at)}</td>
            <td><strong class="tabular-nums">${escapeHtml(log.action)}</strong></td>
            <td>${escapeHtml(log.actor_email)} · ${escapeHtml(log.actor_role)}</td>
            <td class="tabular-nums">${escapeHtml(log.target)}</td>
            <td>${escapeHtml(log.details)}</td>
          </tr>
        `
      )
      .join("");
  }

  async function loadAdminData() {
    try {
      const [ovResp, usersResp, scansResp, auditResp] = await Promise.all([
        fetch(API_ENDPOINTS.ADMIN_OVERVIEW, { headers: authHeaders() }),
        fetch(API_ENDPOINTS.ADMIN_USERS, { headers: authHeaders() }),
        fetch(API_ENDPOINTS.ADMIN_SCANS, { headers: authHeaders() }),
        fetch(API_ENDPOINTS.ADMIN_AUDIT, { headers: authHeaders() }),
      ]);

      const [ovData, usersData, scansData, auditData] = await Promise.all([
        parseApiResponse(ovResp),
        parseApiResponse(usersResp),
        parseApiResponse(scansResp),
        parseApiResponse(auditResp),
      ]);

      if (ovResp.ok && ovData.data && ovData.data.overview) {
        const ov = ovData.data.overview;
        el.admTotalUsers.textContent = String(ov.total_users);
        el.admActiveUsersSub.textContent = `${ov.active_users} ${t("statusActive")} · ${ov.admin_count} ${t("roleAdmin")}`;
        el.admTotalScans.textContent = String(ov.total_scans);
        el.admDiseaseRateSub.textContent = `${ov.disease_rate}% ${t("filterDiseased")}`;
        el.admFlaggedScans.textContent = String(ov.flagged_scans);
        el.admAuditCount.textContent = String(ov.audit_events);
      }
      if (usersResp.ok && usersData.data && Array.isArray(usersData.data.users)) {
        state.adminUsers = usersData.data.users;
        renderAdminUsers();
      }
      if (scansResp.ok && scansData.data && Array.isArray(scansData.data.scans)) {
        state.adminScans = scansData.data.scans;
        renderAdminScans();
      }
      if (auditResp.ok && auditData.data && Array.isArray(auditData.data.logs)) {
        state.adminAuditLogs = auditData.data.logs;
        renderAdminAudit();
      }
    } catch {
      // Ignore transient errors
    }
  }

  async function renderAdminView() {
    await refreshBootstrapStatus();
    el.adminClaimError.hidden = true;

    const user = state.currentUser;
    if (user && user.role === "admin") {
      el.adminAccessGate.hidden = true;
      el.adminWorkspace.hidden = false;
      el.adminHeaderActions.hidden = false;
      loadAdminData();
      return;
    }

    el.adminAccessGate.hidden = false;
    el.adminWorkspace.hidden = true;
    el.adminHeaderActions.hidden = true;

    if (!user) {
      el.adminGateGuestActions.hidden = false;
      el.adminClaimForm.hidden = true;
      return;
    }

    el.adminGateGuestActions.hidden = true;
    const canClaimFirstRun = !state.bootstrapStatus.admin_exists;
    const hasPasscode = state.bootstrapStatus.passcode_configured;

    if (canClaimFirstRun || hasPasscode) {
      el.adminClaimForm.hidden = false;
      el.adminPasscodeRow.hidden = !hasPasscode;
      el.adminClaimHelp.textContent = hasPasscode ? t("adminPasscodeHelp") : t("adminFirstRunHelp");
    } else {
      el.adminClaimForm.hidden = true;
      el.adminGateDesc.textContent = `${t("adminLockedHelp")} (${user.email})`;
    }
  }

  async function handleClaimAdmin(event) {
    event.preventDefault();
    el.adminClaimError.hidden = true;
    try {
      const resp = await fetch(API_ENDPOINTS.AUTH_CLAIM_ADMIN, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ passcode: el.adminClaimPasscode.value }),
      });
      const { data } = await parseApiResponse(resp);
      if (!resp.ok || !data || !data.success) {
        el.adminClaimErrorMsg.textContent = (data && data.error) || "Unable to verify administrator claim.";
        el.adminClaimError.hidden = false;
        return;
      }
      el.adminClaimPasscode.value = "";
      state.currentUser = data.user;
      state.bootstrapStatus.admin_exists = true;
      renderAccountChrome();
      renderAdminView();
    } catch {
      el.adminClaimErrorMsg.textContent = "Unable to connect to server.";
      el.adminClaimError.hidden = false;
    }
  }

  /* ------------------------------------------------------------------------
     Image Validation, Upload & Prediction (/api/predict)
     ------------------------------------------------------------------------ */
  function showUploadError(title, message) {
    el.uploadErrorTitle.textContent = title;
    el.uploadErrorMessage.textContent = message;
    el.uploadError.hidden = false;
  }

  function hideUploadError() {
    el.uploadError.hidden = true;
    el.uploadErrorMessage.textContent = "";
  }

  function validateSelectedFile(file) {
    if (!file) {
      return { valid: false, title: t("errNoFileTitle"), message: t("errNoFileMsg") };
    }
    const fileName = (file.name || "").toLowerCase();
    const hasValidExt = UPLOAD_CONSTRAINTS.ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    const hasValidMime = UPLOAD_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.type);
    if (!hasValidExt || (file.type && !hasValidMime)) {
      return { valid: false, title: t("errFormatTitle"), message: t("errFormatMsg") };
    }
    if (file.size === 0) {
      return { valid: false, title: t("errEmptyTitle"), message: t("errEmptyMsg") };
    }
    if (file.size > UPLOAD_CONSTRAINTS.MAX_SIZE_BYTES) {
      return {
        valid: false,
        title: t("errSizeTitle"),
        message: `${t("errSizePrefix")} (${formatFileSize(file.size)}). ${t("errSizeSuffix")}`,
      };
    }
    return { valid: true };
  }

  function revokePreviewUrl() {
    if (state.previewObjectUrl) {
      URL.revokeObjectURL(state.previewObjectUrl);
      state.previewObjectUrl = null;
    }
  }

  function handleFileSelection(file) {
    hideUploadError();
    const check = validateSelectedFile(file);
    if (!check.valid) {
      showUploadError(check.title, check.message);
      return;
    }
    revokePreviewUrl();
    const objectUrl = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      state.selectedFile = file;
      state.previewObjectUrl = objectUrl;
      el.previewImage.src = objectUrl;
      el.previewFilename.textContent = file.name;
      el.previewFilesize.textContent = formatFileSize(file.size);
      el.previewDimensions.textContent = `${probe.naturalWidth} × ${probe.naturalHeight} px`;
      el.dropzone.hidden = true;
      el.previewContainer.hidden = false;
    };
    probe.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showUploadError(t("errDecodeTitle"), t("errDecodeMsg"));
    };
    probe.src = objectUrl;
  }

  function clearSelectedImage() {
    revokePreviewUrl();
    state.selectedFile = null;
    el.fileInput.value = "";
    el.previewImage.src = "";
    el.previewContainer.hidden = true;
    el.dropzone.hidden = false;
    hideUploadError();
  }

  function setAnalyzingState(isLoading) {
    state.isAnalyzing = isLoading;
    el.analysisLoading.hidden = !isLoading;
    el.analyzeBtn.disabled = isLoading;
    el.changeImageBtn.disabled = isLoading;
    el.clearImageBtn.disabled = isLoading;
  }

  function populateList(listElement, items, fallbackText) {
    listElement.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      const li = document.createElement("li");
      li.textContent = fallbackText;
      listElement.appendChild(li);
      return;
    }
    items.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = String(entry);
      listElement.appendChild(li);
    });
  }

  function renderPredictionResult(data) {
    state.lastPrediction = data;
    const prediction = data.prediction || {};
    const diseaseInfo = data.disease_info || {};
    const plantName = prediction.plant || "Unknown Plant";
    const diseaseName = prediction.disease || "Unknown Condition";
    const confidenceVal = Number(prediction.confidence);
    const healthy = isHealthyCondition(diseaseName);

    el.resultStatusIndicator.classList.remove("is-healthy", "is-diseased");
    el.resultStatusIndicator.classList.add(healthy ? "is-healthy" : "is-diseased");
    el.resultStatusIcon.innerHTML = healthy ? ICONS.healthy : ICONS.diseased;
    el.resultStatusLabel.textContent = healthy ? t("statusHealthy") : t("statusDiseased");
    el.resultScanId.textContent =
      data.scan_id !== undefined && data.scan_id !== null ? `${t("scanIdPrefix")}${data.scan_id}` : "";

    if (state.previewObjectUrl) {
      el.resultPlantImage.src = state.previewObjectUrl;
    }
    el.resultPlantImage.alt = `${plantName} — ${diseaseName}`;
    el.resultPlantName.textContent = plantName;
    el.resultDiseaseName.textContent = diseaseName;
    el.resultDiseaseName.classList.remove("is-healthy", "is-diseased");
    el.resultDiseaseName.classList.add(healthy ? "is-healthy" : "is-diseased");

    const clampedConf = Number.isFinite(confidenceVal) ? Math.max(0, Math.min(100, confidenceVal)) : 0;
    el.resultConfidence.textContent = Number.isFinite(confidenceVal) ? `${clampedConf.toFixed(1)}%` : "—";
    el.resultConfidenceBarTrack.setAttribute("aria-valuenow", String(clampedConf));
    el.resultConfidenceBar.classList.remove("is-healthy", "is-diseased");
    el.resultConfidenceBar.classList.add(healthy ? "is-healthy" : "is-diseased");
    el.resultConfidenceBar.style.width = `${clampedConf}%`;

    el.resultDescription.textContent = diseaseInfo.description || t("fallbackDesc");
    populateList(el.resultSymptoms, diseaseInfo.symptoms, t("fallbackSymptoms"));
    populateList(el.resultRecommendations, diseaseInfo.recommendations, t("fallbackRecommendations"));
    updateDetectWeatherContext();

    el.resultsEmpty.hidden = true;
    el.resultsContent.hidden = false;
  }

  function prepareImageForUpload(file) {
    const MAX_DIMENSION = 896;
    const SIZE_THRESHOLD = 300 * 1024;
    if (file.size <= SIZE_THRESHOLD) return Promise.resolve(file);

    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
        const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
        const targetH = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            const baseName = (file.name || "leaf").replace(/\.[^.]+$/, "");
            resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.84
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  async function submitPrediction() {
    if (!state.selectedFile || state.isAnalyzing) return;

    hideUploadError();
    setAnalyzingState(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 75000);

    try {
      const optimizedFile = await prepareImageForUpload(state.selectedFile);
      const formData = new FormData();
      formData.append("image", optimizedFile);
      formData.append("lang", state.language);

      const response = await fetch(API_ENDPOINTS.PREDICT, {
        method: "POST",
        body: formData,
        headers: authHeaders(),
        signal: controller.signal,
      });

      const { data, contentType } = await parseApiResponse(response);
      if (!response.ok || !data || data.success !== true || !data.prediction) {
        let backendError = data && (data.error || data.message);
        if (!backendError && !data) {
          backendError = contentType.includes("text/html")
            ? t("errHtmlBody")
            : `Unexpected server response (HTTP ${response.status}).`;
        }
        showUploadError(
          t("errAnalysisTitle"),
          backendError || `Prediction request failed with status ${response.status}.`
        );
        return;
      }

      renderPredictionResult(data);
      fetchDashboardStats();
      fetchScanHistory();
    } catch (error) {
      if (error && error.name === "AbortError") {
        showUploadError(t("errTimeoutTitle"), t("errTimeoutMsg"));
      } else {
        showUploadError(t("errNetworkTitle"), t("errNetworkMsg"));
      }
    } finally {
      window.clearTimeout(timeoutId);
      setAnalyzingState(false);
    }
  }

  function resetForAnotherScan() {
    state.lastPrediction = null;
    clearSelectedImage();
    el.resultsContent.hidden = true;
    el.resultsEmpty.hidden = false;
    el.resultConfidenceBar.classList.remove("is-healthy", "is-diseased");
    el.resultConfidenceBar.style.width = "0%";
    el.dropzone.focus();
  }

  /* ------------------------------------------------------------------------
     Scan Detail Modal
     ------------------------------------------------------------------------ */
  function openScanModal(scanId) {
    const record = state.historyItems.find((item) => String(item.id) === String(scanId));
    if (!record) return;

    const healthy = isHealthyCondition(record.disease);
    const statusClass = healthy ? "is-healthy" : "is-diseased";
    const statusIcon = healthy ? ICONS.healthy : ICONS.diseased;
    const plant = escapeHtml(record.plant || "Unknown Plant");
    const disease = escapeHtml(record.disease || "Unknown Condition");
    const confidence = formatConfidence(record.confidence);
    const createdAt = escapeHtml(record.created_at || "—");
    const safeUrl = record.image_url ? escapeHtml(record.image_url) : "";
    const noteHtml = record.review_note
      ? `<div class="weather-context-note"><strong>${escapeHtml(t("colReviewNote"))}:</strong> <p class="detail-text">${escapeHtml(record.review_note)}</p></div>`
      : "";

    const imageBlock = safeUrl
      ? `<img src="${safeUrl}" alt="${plant} leaf" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />
         <span class="scan-thumb-fallback" style="display:none;" aria-hidden="true">${ICONS.leafFallback}</span>`
      : `<span class="scan-thumb-fallback" aria-hidden="true">${ICONS.leafFallback}</span>`;

    el.modalBody.innerHTML = `
      <div class="modal-image-wrap">${imageBlock}</div>
      <div class="modal-meta-grid">
        <div class="metric-item">
          <span class="metric-label">${escapeHtml(t("modalPlantLabel"))}</span>
          <span class="metric-value">${plant}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">${escapeHtml(t("modalConfidenceLabel"))}</span>
          <span class="metric-value tabular-nums">${confidence}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">${escapeHtml(t("modalConditionLabel"))}</span>
          <span class="condition-cell ${statusClass}">
            <span class="condition-icon" aria-hidden="true">${statusIcon}</span>
            <span>${disease}</span>
          </span>
        </div>
        <div class="metric-item">
          <span class="metric-label">${escapeHtml(t("modalDateLabel"))}</span>
          <span class="tabular-nums">${createdAt}</span>
        </div>
      </div>
      ${noteHtml}
    `;

    el.modalBackdrop.hidden = false;
    el.modalCloseBtn.focus();
  }

  function closeScanModal() {
    el.modalBackdrop.hidden = true;
    el.modalBody.innerHTML = "";
  }

  /* ------------------------------------------------------------------------
     Event Listeners & Initialization
     ------------------------------------------------------------------------ */
  function initEventListeners() {
    if (el.languageSelect) {
      el.languageSelect.value = state.language;
      el.languageSelect.addEventListener("change", (event) => applyLanguage(event.target.value));
    }

    // Account & Auth
    el.sidebarAuthBtn.addEventListener("click", () => openAuthModal("login"));
    el.topbarAccountBtn.addEventListener("click", () => openAuthModal("login"));
    el.sidebarLogoutBtn.addEventListener("click", logoutUser);
    el.profileLogoutBtn.addEventListener("click", logoutUser);
    el.profileOpenAdminBtn.addEventListener("click", () => {
      closeAuthModal();
      switchView("admin");
    });
    el.authModalCloseBtn.addEventListener("click", closeAuthModal);
    el.authModalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.authModalBackdrop) closeAuthModal();
    });
    el.authTabButtons.forEach((btn) => {
      btn.addEventListener("click", () => setAuthTab(btn.getAttribute("data-auth-tab")));
    });
    el.loginForm.addEventListener("submit", handleLoginSubmit);
    el.registerForm.addEventListener("submit", handleRegisterSubmit);
    el.profileForm.addEventListener("submit", handleProfileSave);

    // Upload & Prediction
    el.browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      el.fileInput.click();
    });
    el.dropzone.addEventListener("click", () => el.fileInput.click());
    el.dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.fileInput.click();
      }
    });
    el.fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) handleFileSelection(e.target.files[0]);
    });
    ["dragenter", "dragover"].forEach((name) => {
      el.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach((name) => {
      el.dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropzone.classList.remove("is-dragover");
      });
    });
    el.dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
    el.changeImageBtn.addEventListener("click", () => el.fileInput.click());
    el.clearImageBtn.addEventListener("click", clearSelectedImage);
    el.analyzeBtn.addEventListener("click", submitPrediction);
    el.scanAnotherBtn.addEventListener("click", resetForAnotherScan);

    // Weather
    el.weatherSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = el.weatherCityInput.value.trim();
      if (!q) return;
      state.weatherQuery = { city: q, lat: null, lon: null };
      fetchWeather();
    });
    el.weatherGeoBtn.addEventListener("click", () => {
      if (!navigator.geolocation) {
        el.weatherErrorMessage.textContent = "Geolocation is not supported in this browser.";
        el.weatherErrorBanner.hidden = false;
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.weatherQuery = {
            city: "",
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          fetchWeather();
        },
        () => {
          el.weatherErrorMessage.textContent = "Location access was denied. Enter a city name instead.";
          el.weatherErrorBanner.hidden = false;
        }
      );
    });

    // Analytics
    el.refreshAnalyticsBtn.addEventListener("click", fetchAnalytics);
    el.exportCsvBtn.addEventListener("click", exportHistoryCsv);
    el.analyticsScopeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const scope = btn.getAttribute("data-analytics-scope") || "all";
        if (scope === "mine" && !state.currentUser) {
          openAuthModal("login");
          return;
        }
        state.analyticsScope = scope;
        el.analyticsScopeButtons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        fetchAnalytics();
      });
    });

    // Dashboard & History
    el.refreshDashboardBtn.addEventListener("click", () => {
      fetchDashboardStats();
      fetchScanHistory();
      fetchWeather();
    });
    el.retryStatsBtn.addEventListener("click", fetchDashboardStats);
    el.retryRecentBtn.addEventListener("click", fetchScanHistory);
    el.refreshHistoryBtn.addEventListener("click", fetchScanHistory);
    el.retryHistoryBtn.addEventListener("click", fetchScanHistory);

    el.historySearch.addEventListener("input", (e) => {
      state.historyQuery = e.target.value || "";
      renderHistoryTable();
    });
    el.filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.historyFilter = btn.getAttribute("data-filter") || "all";
        el.filterButtons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        renderHistoryTable();
      });
    });
    el.historyScopeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const scope = btn.getAttribute("data-history-scope") || "all";
        if (scope === "mine" && !state.currentUser) {
          openAuthModal("login");
          return;
        }
        state.historyScope = scope;
        el.historyScopeButtons.forEach((b) => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        fetchScanHistory();
      });
    });

    // Admin Console Listeners
    el.adminRefreshBtn.addEventListener("click", loadAdminData);
    el.adminOpenLoginBtn.addEventListener("click", () => openAuthModal("login"));
    el.adminOpenRegisterBtn.addEventListener("click", () => openAuthModal("register"));
    el.adminClaimForm.addEventListener("submit", handleClaimAdmin);
    el.adminTabButtons.forEach((btn) => {
      btn.addEventListener("click", () => setAdminTab(btn.getAttribute("data-admin-tab")));
    });
    el.adminUserSearch.addEventListener("input", (e) => {
      state.adminUserSearch = e.target.value || "";
      renderAdminUsers();
    });
    el.adminScanFilterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.adminScanFilter = btn.getAttribute("data-admin-scan-filter") || "all";
        el.adminScanFilterButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
        renderAdminScans();
      });
    });

    // Delegated click handlers (History inspect/delete + Admin row mutations)
    document.addEventListener("click", async (event) => {
      const inspectBtn = event.target.closest("[data-inspect-id]");
      if (inspectBtn) {
        openScanModal(inspectBtn.getAttribute("data-inspect-id"));
        return;
      }

      const deleteScanBtn = event.target.closest("[data-delete-scan-id]");
      if (deleteScanBtn) {
        await deleteHistoryScan(deleteScanBtn.getAttribute("data-delete-scan-id"));
        return;
      }

      const saveUserBtn = event.target.closest("[data-admin-save-user]");
      if (saveUserBtn) {
        const userId = saveUserBtn.getAttribute("data-admin-save-user");
        const roleSelect = document.querySelector(`[data-admin-role-select="${CSS.escape(userId)}"]`);
        const statusSelect = document.querySelector(`[data-admin-status-select="${CSS.escape(userId)}"]`);
        if (roleSelect && statusSelect) {
          const resp = await fetch(`${API_ENDPOINTS.ADMIN_USERS}/${encodeURIComponent(userId)}`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ role: roleSelect.value, status: statusSelect.value }),
          });
          if (resp.ok) loadAdminData();
        }
        return;
      }

      const flagScanBtn = event.target.closest("[data-admin-flag-scan]");
      if (flagScanBtn) {
        const scanId = flagScanBtn.getAttribute("data-admin-flag-scan");
        const flagged = flagScanBtn.getAttribute("data-next-flagged") === "true";
        const resp = await fetch(`${API_ENDPOINTS.ADMIN_SCANS}/${encodeURIComponent(scanId)}`, {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ flagged }),
        });
        if (resp.ok) {
          loadAdminData();
          fetchScanHistory();
        }
        return;
      }

      const saveNoteBtn = event.target.closest("[data-admin-save-note]");
      if (saveNoteBtn) {
        const scanId = saveNoteBtn.getAttribute("data-admin-save-note");
        const noteInput = document.querySelector(`[data-admin-note-input="${CSS.escape(scanId)}"]`);
        if (noteInput) {
          const resp = await fetch(`${API_ENDPOINTS.ADMIN_SCANS}/${encodeURIComponent(scanId)}`, {
            method: "PATCH",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ review_note: noteInput.value.trim() }),
          });
          if (resp.ok) loadAdminData();
        }
        return;
      }

      const adminDelScanBtn = event.target.closest("[data-admin-delete-scan]");
      if (adminDelScanBtn) {
        const scanId = adminDelScanBtn.getAttribute("data-admin-delete-scan");
        const resp = await fetch(`${API_ENDPOINTS.ADMIN_SCANS}/${encodeURIComponent(scanId)}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (resp.ok) {
          loadAdminData();
          fetchDashboardStats();
          fetchScanHistory();
        }
      }
    });

    // Modal dismiss
    el.modalCloseBtn.addEventListener("click", closeScanModal);
    el.modalDismissBtn.addEventListener("click", closeScanModal);
    el.modalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.modalBackdrop) closeScanModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!el.modalBackdrop.hidden) closeScanModal();
        if (!el.authModalBackdrop.hidden) closeAuthModal();
      }
    });
  }

  function init() {
    initNavigation();
    initEventListeners();
    applyLanguage(state.language);
    refreshBootstrapStatus();
    fetchDashboardStats();
    fetchScanHistory();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
