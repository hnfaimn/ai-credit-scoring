from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import shap
import warnings
warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

# ── Load models ──────────────────────────────────────────────────────────
print("Loading models...")
import os
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
xgb_model = joblib.load(os.path.join(BASE_DIR, "models", "xgb_model.pkl"))
scaler     = joblib.load(os.path.join(BASE_DIR, "models", "scaler.pkl"))
explainer  = shap.TreeExplainer(xgb_model)
print("✅ Models loaded!")

# ── Feature labels ───────────────────────────────────────────────────────
FEATURE_LABELS = {
    "Checking account"  : "checking account status",
    "Duration"          : "loan duration",
    "Credit amount"     : "credit amount requested",
    "Saving accounts"   : "savings account status",
    "Age"               : "age",
    "Purpose"           : "loan purpose",
    "Housing"           : "housing situation",
    "Sex"               : "gender",
    "Job"               : "employment type",
    "Unnamed: 0"        : "applicant record"
}

# ── Recommendation rules ─────────────────────────────────────────────────
RECOMMENDATION_RULES = {
    "Checking account": {
        "tip"   : "Reduce monthly debt and maintain a positive checking account balance.",
        "reason": "Checking account status is the strongest predictor of credit risk."
    },
    "Duration": {
        "tip"   : "Consider applying for a shorter loan duration if possible.",
        "reason": "Longer loan durations increase perceived repayment risk."
    },
    "Credit amount": {
        "tip"   : "Apply for a lower loan amount relative to your income.",
        "reason": "Higher loan amounts increase the likelihood of default."
    },
    "Saving accounts": {
        "tip"   : "Build up your savings and reduce outstanding financing before reapplying.",
        "reason": "Low savings indicates financial vulnerability."
    },
    "Age": {
        "tip"   : "Build a credit history through smaller loans first.",
        "reason": "Age reflects financial experience and stability."
    },
    "Purpose": {
        "tip"   : "Essential loan purposes (education, car) are viewed more favourably.",
        "reason": "Loan purpose is associated with repayment intent."
    },
    "Housing": {
        "tip"   : "Property ownership improves your credit profile significantly.",
        "reason": "Housing stability indicates financial responsibility."
    },
    "Job": {
        "tip"   : "Stable skilled employment improves your credit profile.",
        "reason": "Employment type reflects repayment reliability."
    },
    "Sex": {
        "tip"   : "Gender should not affect your application — monitored for fairness.",
        "reason": "Tracked to ensure non-discriminatory decisions."
    },
}

# ── Mapping constants ─────────────────────────────────────────────────────
REPAYMENT_MAP = {
    "excellent": 3,
    "good"     : 2,
    "fair"     : 1,
    "poor"     : 0
}
HOUSING_MAP = {"own": 2, "rent": 1, "free": 0}
PURPOSE_MAP = {
    "car": 0, "furniture/equipment": 1,
    "radio/TV": 2, "repairs": 4,
    "education": 5, "business": 6,
    "vacation/others": 7
}
SEX_MAP = {"male": 1, "female": 0}

# ── Mapping functions ─────────────────────────────────────────────────────
def get_job(employment_status, employment_type):
    if employment_status in ["unemployed", "retired"]:
        return 0
    if employment_type == "highly_skilled":
        return 3
    if employment_type == "skilled":
        return 2
    return 1

def compute_checking(monthly_debt, credit_card_balance, repayment_history):
    """
    Maps to checking account 0-3.
    Higher = better (less risk).
    """
    # Base from repayment history (dominant factor)
    base = {
        "excellent": 3.0,
        "good"     : 2.0,
        "fair"     : 1.0,
        "poor"     : 0.0
    }.get(repayment_history, 1.0)

    # Debt adjustment — stronger impact
    if monthly_debt < 200:     debt_adj = +0.5
    elif monthly_debt < 500:   debt_adj = +0.2
    elif monthly_debt < 1000:  debt_adj =  0.0
    elif monthly_debt < 2000:  debt_adj = -0.5
    elif monthly_debt < 3000:  debt_adj = -1.0
    else:                      debt_adj = -1.5

    # Card balance adjustment
    if credit_card_balance < 200:    bal_adj = +0.2
    elif credit_card_balance < 1000: bal_adj =  0.0
    elif credit_card_balance < 3000: bal_adj = -0.2
    else:                            bal_adj = -0.4

    total = base + debt_adj + bal_adj
    return round(max(0.0, min(3.0, total)), 4)


def compute_saving(savings, credit_card_limit, monthly_housing_payment):
    """
    Maps to saving accounts 0-4.
    Higher = better (less risk).
    """
    # Base from savings
    if savings > 10000:   base = 4.0
    elif savings > 5000:  base = 3.0
    elif savings > 1000:  base = 2.0
    elif savings > 200:   base = 1.0
    else:                 base = 0.0

    # Credit limit adjustment
    if credit_card_limit > 10000:  lim_adj = +0.3
    elif credit_card_limit > 5000: lim_adj = +0.1
    else:                          lim_adj = -0.1

    # Housing payment adjustment
    if monthly_housing_payment < 300:   pay_adj = +0.2
    elif monthly_housing_payment < 800:  pay_adj =  0.0
    elif monthly_housing_payment < 2000: pay_adj = -0.2
    else:                               pay_adj = -0.4

    total = base + lim_adj + pay_adj
    return round(max(0.0, min(4.0, total)), 4)

def preprocess_input(data: dict) -> pd.DataFrame:
    """Convert user-friendly fields to scaled model features."""
    checking = compute_checking(
        data.get("monthly_debt", 0),
        data.get("credit_card_balance", 0),
        data.get("repayment_history", "good")
    )
    saving = compute_saving(
        data.get("savings", 0),
        data.get("credit_card_limit", 0),
        data.get("monthly_housing_payment", 0)
    )
    row = {
        "Unnamed: 0"      : 0,
        "Age"             : float(data.get("age", 30)),
        "Sex"             : float(SEX_MAP.get(data.get("gender","male"), 1)),
        "Job"             : float(get_job(
                                data.get("employment_status","employed"),
                                data.get("employment_type","skilled"))),
        "Housing"         : float(HOUSING_MAP.get(
                                data.get("housing_status","own"), 1)),
        "Saving accounts" : saving,
        "Checking account": checking,
        "Credit amount"   : float(data.get("loan_amount", 1000)) +
                            float(data.get("outstanding_financing", 0)) * 0.5,
        "Duration"        : float(data.get("loan_duration", 12)),
        "Purpose"         : float(PURPOSE_MAP.get(
                                data.get("loan_purpose","car"), 0)),
    }
    all_cols = ["Unnamed: 0","Age","Sex","Job","Housing",
                "Saving accounts","Checking account",
                "Credit amount","Duration","Purpose"]
    df        = pd.DataFrame([row])[all_cols]
    df_scaled = pd.DataFrame(scaler.transform(df), columns=all_cols)
    return df_scaled

# ── Explanation helpers ───────────────────────────────────────────────────
def get_explanation(shap_vals, feature_names, top_n=3):
    pairs   = list(zip(feature_names, shap_vals))
    sorted_ = sorted(pairs, key=lambda x: abs(x[1]), reverse=True)
    result  = []
    for feature, val in sorted_[:top_n]:
        if feature == "Unnamed: 0":
            continue
        label     = FEATURE_LABELS.get(feature, feature)
        direction = "increased" if val > 0 else "reduced"
        strength  = ("significantly" if abs(val) > 0.5
                     else "moderately" if abs(val) > 0.2
                     else "slightly")
        result.append({
            "feature"  : feature,
            "label"    : label,
            "shap_val" : round(float(val), 4),
            "direction": direction,
            "sentence" : (f"Your {label} {strength} {direction} "
                          f"your credit risk (impact: {val:+.3f}).")
        })
    return result

def get_recommendations(shap_vals, feature_names):
    pairs    = list(zip(feature_names, shap_vals))
    neg_only = [(f, v) for f, v in pairs
                if v > 0 and f in RECOMMENDATION_RULES
                and f != "Unnamed: 0"]
    sorted_  = sorted(neg_only, key=lambda x: x[1], reverse=True)
    tips = []
    for rank, (feature, val) in enumerate(sorted_[:3], start=1):
        rule = RECOMMENDATION_RULES[feature]
        tips.append({
            "rank"    : rank,
            "feature" : feature,
            "shap_val": round(float(val), 4),
            "tip"     : rule["tip"],
            "reason"  : rule["reason"],
            "priority": ("High"   if val > 0.5
                         else "Medium" if val > 0.2
                         else "Low")
        })
    return tips

# ── Routes ────────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message"  : "✅ Credit Scoring API is running!",
        "endpoints": ["/predict", "/explain", "/simulate", "/health"]
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "models_loaded": True})

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data      = request.get_json()
        df_scaled = preprocess_input(data)
        prob_bad  = float(xgb_model.predict_proba(df_scaled)[0][1])
        prob_good = round((1 - prob_bad) * 100, 1)
        return jsonify({
            "success"      : True,
            "credit_score" : prob_good,
            "approval_prob": prob_good,
            "decision"     : "Approved" if prob_good >= 50 else "Rejected",
            "risk_class"   : ("Low Risk"    if prob_good >= 70
                              else "Medium Risk" if prob_good >= 50
                              else "High Risk"),
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/explain", methods=["POST"])
def explain():
    try:
        data          = request.get_json()
        df_scaled     = preprocess_input(data)
        shap_vals     = explainer.shap_values(df_scaled)[0]
        feature_names = df_scaled.columns.tolist()
        explanations  = get_explanation(shap_vals, feature_names)
        tips          = get_recommendations(shap_vals, feature_names)
        prob_bad      = float(xgb_model.predict_proba(df_scaled)[0][1])
        prob_good     = round((1 - prob_bad) * 100, 1)
        return jsonify({
            "success"        : True,
            "credit_score"   : prob_good,
            "decision"       : "Approved" if prob_good >= 50 else "Rejected",
            "explanations"   : explanations,
            "recommendations": tips,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route("/simulate", methods=["POST"])
def simulate():
    try:
        data              = request.get_json()
        feature_to_change = data.pop("feature_to_change")
        new_value         = data.pop("new_value")

        # Convert numeric strings
        try:
            new_value = float(new_value)
            if new_value == int(new_value):
                new_value = int(new_value)
        except (ValueError, TypeError):
            pass

        # Current probability
        df_current   = preprocess_input(data.copy())
        prob_current = round(
            (1 - float(xgb_model.predict_proba(df_current)[0][1])) * 100, 1
        )

        # Modified probability
        data_modified = data.copy()
        data_modified[feature_to_change] = new_value
        df_modified = preprocess_input(data_modified)
        prob_new    = round(
            (1 - float(xgb_model.predict_proba(df_modified)[0][1])) * 100, 1
        )

        improvement = round(prob_new - prob_current, 1)

        # Debug
        print(f"\nSIMULATE: {feature_to_change} → {new_value}")
        print(f"  checking : {compute_checking(data.get('monthly_debt',0), data.get('credit_card_balance',0), data.get('repayment_history','good'))} → "
              f"{compute_checking(data_modified.get('monthly_debt',0), data_modified.get('credit_card_balance',0), data_modified.get('repayment_history','good'))}")
        print(f"  saving   : {compute_saving(data.get('savings',0), data.get('credit_card_limit',0), data.get('monthly_housing_payment',0))} → "
              f"{compute_saving(data_modified.get('savings',0), data_modified.get('credit_card_limit',0), data_modified.get('monthly_housing_payment',0))}")
        print(f"  prob     : {prob_current}% → {prob_new}% ({improvement:+}%)")

        return jsonify({
            "success"               : True,
            "feature_changed"       : feature_to_change,
            "new_value_applied"     : str(new_value),
            "current_approval_prob" : prob_current,
            "new_approval_prob"     : prob_new,
            "improvement"           : improvement,
            "current_decision"      : "Approved" if prob_current >= 50 else "Rejected",
            "new_decision"          : "Approved" if prob_new >= 50 else "Rejected",
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

# ── Run ───────────────────────────────────────────────────────────────────
# ── Run ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)