
import numpy as np
import joblib
import shap

def load_models():
    xgb_model = joblib.load("models/xgb_model.pkl")
    scaler     = joblib.load("models/scaler.pkl")
    return xgb_model, scaler

def get_shap_values(xgb_model, X_scaled):
    explainer  = shap.TreeExplainer(xgb_model)
    shap_values = explainer.shap_values(X_scaled)
    return explainer, shap_values

def plain_language_explanation(shap_vals, feature_names, top_n=3):
    feature_labels = {
        "Checking account"  : "checking account status",
        "Duration"          : "loan duration",
        "Credit amount"     : "credit amount requested",
        "Saving accounts"   : "savings account status",
        "Age"               : "age",
        "Purpose"           : "loan purpose",
        "Housing"           : "housing situation",
        "Sex"               : "gender",
        "Job"               : "job type",
    }
    shap_pairs  = list(zip(feature_names, shap_vals))
    shap_sorted = sorted(shap_pairs, key=lambda x: abs(x[1]), reverse=True)
    explanations = []
    for feature, shap_val in shap_sorted[:top_n]:
        label     = feature_labels.get(feature, feature)
        direction = "increased" if shap_val > 0 else "reduced"
        strength  = "significantly" if abs(shap_val) > 0.5 else "moderately" if abs(shap_val) > 0.2 else "slightly"
        explanations.append({
            "feature"  : feature,
            "label"    : label,
            "shap_val" : shap_val,
            "direction": direction,
            "sentence" : f"Your {label} {strength} {direction} your credit risk (impact: {shap_val:+.3f})."
        })
    return explanations

def recommendation_engine(shap_vals, feature_names):
    rules = {
        "Checking account": {"tip": "Open or maintain an active checking account with a positive balance.", "reason": "Checking account status is the strongest predictor of credit risk."},
        "Duration"        : {"tip": "Consider applying for a shorter loan duration.", "reason": "Longer durations increase repayment risk."},
        "Credit amount"   : {"tip": "Apply for a lower credit amount relative to your income.", "reason": "Higher amounts increase default risk."},
        "Saving accounts" : {"tip": "Build up your savings before reapplying.", "reason": "Low savings indicates financial vulnerability."},
        "Age"             : {"tip": "Build a credit history through smaller loans first.", "reason": "Age reflects financial experience and stability."},
        "Purpose"         : {"tip": "Essential loan purposes are viewed more favourably.", "reason": "Loan purpose is associated with repayment intent."},
        "Housing"         : {"tip": "Property ownership improves your credit profile.", "reason": "Housing stability indicates financial responsibility."},
        "Job"             : {"tip": "Stable skilled employment improves your credit profile.", "reason": "Employment type reflects repayment reliability."},
    }
    shap_pairs   = list(zip(feature_names, shap_vals))
    neg_factors  = sorted([(f,v) for f,v in shap_pairs if v > 0 and f in rules], key=lambda x: x[1], reverse=True)
    tips = []
    for rank, (feature, shap_val) in enumerate(neg_factors[:3], start=1):
        rule = rules[feature]
        tips.append({
            "rank"    : rank,
            "feature" : feature,
            "shap_val": shap_val,
            "tip"     : rule["tip"],
            "reason"  : rule["reason"],
            "priority": "High" if shap_val > 0.5 else "Medium" if shap_val > 0.2 else "Low"
        })
    return tips

def simulate_approval(applicant_data, feature_to_change, new_value, xgb_model):
    current_prob_good = 1 - xgb_model.predict_proba(applicant_data)[0][1]
    modified_data     = applicant_data.copy()
    modified_data[feature_to_change] = new_value
    new_prob_good     = 1 - xgb_model.predict_proba(modified_data)[0][1]
    return {
        "feature_changed"       : feature_to_change,
        "current_approval_prob" : round(current_prob_good * 100, 2),
        "new_approval_prob"     : round(new_prob_good * 100, 2),
        "improvement"           : round((new_prob_good - current_prob_good) * 100, 2),
        "current_decision"      : "Approved" if current_prob_good >= 0.5 else "Rejected",
        "new_decision"          : "Approved" if new_prob_good >= 0.5 else "Rejected",
    }
