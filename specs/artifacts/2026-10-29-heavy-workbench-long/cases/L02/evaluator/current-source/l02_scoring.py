"""Exact marginal mean/interval scores. This is not a complete L02 grader."""
import argparse
from decimal import Decimal
from fractions import Fraction
import json
from pathlib import Path

from material_contract import read_json


class ProtocolError(ValueError):
    def __init__(self,code,detail):
        self.code=code;self.detail=detail
        super().__init__(code+":"+detail)


def load_study(path):
    value=read_json(path,decimal_numbers=True)
    try:
        supported={"format":"l02-study-contract/1","mean_semantics":"conditional_mean","point_metric":"scaled_mse",
            "point_formula":"((mean-truth)/fixed_scale_litres)^2","interval_metric":"scaled_wis",
            "interval_formula":"WIS(truth,median,central_intervals)/fixed_scale_litres"}
        if any(value[key]!=expected for key,expected in supported.items()):raise ValueError()
        quantiles=[Fraction(q) for q in value["quantiles"]]
        alphas=[Fraction(a) for a in value["interval_alphas"]]
        if len(set(value["quantiles"]))!=len(quantiles) or quantiles!=sorted(set(quantiles)) or not all(0<q<1 for q in quantiles) or Fraction(1,2) not in quantiles:raise ValueError()
        if not alphas or len(set(alphas))!=len(alphas) or not all(0<a<1 and a/2 in quantiles and 1-a/2 in quantiles for a in alphas):raise ValueError()
        weights=value["layer_weights"]
        if set(weights)!={"leaf","aggregate"} or any(Fraction(w)<=0 for w in weights.values()) or sum(Fraction(w) for w in weights.values())!=1:raise ValueError()
        if Fraction(value["maximum_absolute_value"])<=0 or Fraction(value["mean_coherence_relative_tolerance"])<0:raise ValueError()
        for key in ["maximum_significant_digits","maximum_absolute_decimal_exponent"]:
            if type(value[key]) is not int or value[key]<=0:raise ValueError()
    except (KeyError,ValueError,TypeError,ZeroDivisionError) as e:raise ProtocolError("facility_study_invalid","explicit metric definitions required") from e
    return value


def number(value,study):
    if type(value) is int:
        decimal=Decimal(value)
    elif type(value) is Decimal:
        decimal=value
    else:raise ProtocolError("prediction_numeric_invalid","JSON integer or decimal required")
    if not decimal.is_finite():raise ProtocolError("prediction_numeric_invalid","finite values required")
    parts=decimal.as_tuple()
    if len(parts.digits)>study["maximum_significant_digits"] or abs(parts.exponent)>study["maximum_absolute_decimal_exponent"]:
        raise ProtocolError("prediction_numeric_invalid","numeric representation outside the declared protocol")
    fraction=Fraction(decimal)
    if not 0<=fraction<=Fraction(study["maximum_absolute_value"]):raise ProtocolError("prediction_numeric_invalid","nonnegative finite litre forecast in declared range required")
    return fraction


def wis(truth,quantiles,alphas):
    total=abs(truth-quantiles[Fraction(1,2)])/2
    for alpha in alphas:
        lower,upper=quantiles[alpha/2],quantiles[1-alpha/2]
        interval=upper-lower+2/alpha*max(lower-truth,Fraction())+2/alpha*max(truth-upper,Fraction())
        total+=alpha/2*interval
    return total/(len(alphas)+Fraction(1,2))


def validate_context(context,labels):
    try:
        if type(context) is not dict or set(context)!={"format","origin_tick","target_ticks","series_catalogue","hierarchy","scales_litres"} or context["format"]!="l02-score-context/1":raise ValueError()
        origin=context["origin_tick"];targets=context["target_ticks"];catalogue=context["series_catalogue"]
        if type(origin) is not int or origin<0 or type(targets) is not list or not targets or any(type(t) is not int or t<=origin for t in targets) or len(set(targets))!=len(targets):raise ValueError()
        if type(catalogue) is not list or not catalogue:raise ValueError()
        for node in catalogue:
            if type(node) is not dict or set(node)!={"series_id","kind"} or type(node["series_id"]) is not str or not node["series_id"].strip() or node["kind"] not in ("leaf","aggregate"):raise ValueError()
        names=[r["series_id"] for r in catalogue]
        if len(set(names))!=len(names):raise ValueError()
        leaves={r["series_id"] for r in catalogue if r["kind"]=="leaf"};parents=set(names)-leaves
        if not leaves or not parents or type(context["hierarchy"]) is not list:raise ValueError()
        edges=set();children=set();covered=set()
        for edge in context["hierarchy"]:
            if type(edge) is not dict or set(edge)!={"parent","child","weight"} or edge["parent"] not in parents or edge["child"] not in leaves or type(edge["weight"]) is not int or edge["weight"]<=0:raise ValueError()
            key=edge["parent"],edge["child"]
            if key in edges:raise ValueError()
            edges.add(key);children.add(edge["child"]);covered.add(edge["parent"])
        if children!=leaves or covered!=parents or type(context["scales_litres"]) is not dict or set(context["scales_litres"])!=set(names):raise ValueError()
        for value in context["scales_litres"].values():
            if type(value) not in (int,str,Decimal) or Fraction(value)<=0:raise ValueError()
    except (KeyError,TypeError,ValueError,ZeroDivisionError) as e:raise ProtocolError("facility_context_invalid","typed complete nodes, future targets, hierarchy and positive fixed scales required") from e
    required={(name,target) for name in names for target in targets};truth={}
    try:
        if type(labels) is not list:raise ValueError()
        for row in labels:
            if type(row) is not dict or set(row)!={"series_id","target_tick","value"} or type(row["series_id"]) is not str or type(row["target_tick"]) is not int or type(row["value"]) is not int or row["value"]<0:raise ValueError()
            key=row["series_id"],row["target_tick"]
            if key in truth:raise ValueError()
            truth[key]=Fraction(row["value"])
        if set(truth)!=required:raise ValueError()
        for target in targets:
            for parent in parents:
                if truth[parent,target]!=sum(edge["weight"]*truth[edge["child"],target] for edge in context["hierarchy"] if edge["parent"]==parent):raise ValueError()
    except (KeyError,TypeError,ValueError) as e:raise ProtocolError("facility_labels_invalid","complete unique typed nonnegative integer-L truth with registered hierarchy required") from e
    return required,truth


def score(forecast,context,labels,method_id,study):
    required,truth=validate_context(context,labels)
    if type(forecast) is not dict or set(forecast)!={"format","method_id","origin_tick","forecasts"} or forecast["format"]!="l02-distribution-forecasts/1":raise ProtocolError("prediction_schema_invalid","declared forecast format required")
    if type(method_id) is not str or not method_id.strip() or forecast["method_id"]!=method_id or type(forecast["origin_tick"]) is not int or forecast["origin_tick"]!=context["origin_tick"]:raise ProtocolError("prediction_identity_invalid","assigned method/origin required")
    catalogue=context["series_catalogue"];targets=context["target_ticks"]
    if type(forecast["forecasts"]) is not list:raise ProtocolError("prediction_schema_invalid","forecast rows required")
    rows={}
    for row in forecast["forecasts"]:
        if type(row) is not dict or set(row)!={"series_id","target_tick","mean","quantiles"} or type(row["series_id"]) is not str or type(row["target_tick"]) is not int:raise ProtocolError("prediction_schema_invalid","typed forecast fields required")
        key=row["series_id"],row["target_tick"]
        if key in rows or key not in required:raise ProtocolError("prediction_identity_invalid","each assigned business key exactly once")
        if type(row["quantiles"]) is not dict or set(row["quantiles"])!=set(study["quantiles"]):raise ProtocolError("prediction_quantiles_invalid","declared quantile grid required")
        quantiles={Fraction(q):number(row["quantiles"][q],study) for q in study["quantiles"]}
        ordered=sorted(quantiles)
        if any(quantiles[a]>quantiles[b] for a,b in zip(ordered,ordered[1:])):raise ProtocolError("prediction_quantile_order","nondecreasing quantiles required")
        rows[key]={"mean":number(row["mean"],study),"quantiles":quantiles}
    if set(rows)!=required:raise ProtocolError("prediction_incomplete","all registered nodes/targets required")
    for target in targets:
        for parent in [r["series_id"] for r in catalogue if r["kind"]=="aggregate"]:
            terms=[Fraction(r["weight"])*rows[r["child"],target]["mean"] for r in context["hierarchy"] if r["parent"]==parent]
            if not terms:raise ProtocolError("facility_context_invalid","registered aggregate children required")
            parent_mean=rows[parent,target]["mean"];tolerance=Fraction(study["mean_coherence_relative_tolerance"])*max(Fraction(1),abs(parent_mean),sum(abs(t) for t in terms))
            if abs(parent_mean-sum(terms))>tolerance:raise ProtocolError("prediction_mean_incoherent","parent mean must equal the registered child sum")
    alphas=[Fraction(a) for a in study["interval_alphas"]];metrics={};nodes={}
    try:
        for node in catalogue:
            name=node["series_id"];scale=Fraction(context["scales_litres"][name])
            if scale<=0:raise ValueError()
            mse=sum(((rows[name,t]["mean"]-truth[name,t])/scale)**2 for t in targets)/len(targets)
            mae=sum(abs(rows[name,t]["mean"]-truth[name,t])/scale for t in targets)/len(targets)
            interval=sum(wis(truth[name,t],rows[name,t]["quantiles"],alphas)/scale for t in targets)/len(targets)
            nodes[name]={"scaled_mse":mse,"scaled_mae":mae,"scaled_wis":interval}
        for metric in ["scaled_mse","scaled_mae","scaled_wis"]:
            value=Fraction()
            for kind,weight in study["layer_weights"].items():
                selected=[n["series_id"] for n in catalogue if n["kind"]==kind]
                if not selected:raise ValueError()
                value+=Fraction(weight)*sum(nodes[name][metric] for name in selected)/len(selected)
            metrics[metric]=str(value)
    except (KeyError,ValueError,ZeroDivisionError) as e:raise ProtocolError("facility_context_invalid","positive fixed scales and complete hierarchy required") from e
    return {"status":"forecast_assessed","metrics_exact":metrics,"node_metrics_exact":{name:{key:str(value) for key,value in row.items()} for name,row in nodes.items()},
        "rows":len(rows),"scope":"marginal mean/WIS metrics, not a full task grade or joint-distribution validation","candidate_score":None}


if __name__=="__main__":
    p=argparse.ArgumentParser()
    for name in ["study","forecast","context","labels","out"]:p.add_argument("--"+name,type=Path,required=True)
    p.add_argument("--method-id",required=True);a=p.parse_args()
    try:
        study=load_study(a.study)
        context=read_json(a.context,decimal_numbers=True);labels=read_json(a.labels,decimal_numbers=True)
        try:forecast=read_json(a.forecast,decimal_numbers=True)
        except FileNotFoundError as e:raise ProtocolError("prediction_incomplete","forecast file required") from e
        except (OSError,ValueError) as e:raise ProtocolError("prediction_schema_invalid","readable JSON forecast required: "+str(e)) from e
        result=score(forecast,context,labels,a.method_id,study)
    except ProtocolError as e:
        result={"status":"run_invalid" if e.code.startswith("facility_") else "prediction_incomplete" if e.code=="prediction_incomplete" else "prediction_invalid","error":e.code,"detail":e.detail,"candidate_score":None}
    except (OSError,ValueError,KeyError,TypeError) as e:
        result={"status":"run_invalid","error":"facility_protocol_invalid","detail":str(e),"candidate_score":None}
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,indent=2),encoding="utf-8");print(json.dumps(result),flush=True)
    raise SystemExit(0 if result["status"]=="forecast_assessed" else 3 if result["status"]=="run_invalid" else 2)
