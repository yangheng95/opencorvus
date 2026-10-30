"""New-version information-history primitive; not an L06/0.3 business grader."""
from fractions import Fraction


class InformationError(ValueError):
    def __init__(self,code):
        self.code=code
        super().__init__(code)


def check_information(graph,actions):
    if type(graph) is not dict or set(graph)!={'format','weeks','leaves'} or graph['format']!='l06-information-graph/1':raise InformationError('information_graph_invalid')
    weeks=graph['weeks'];leaves=graph['leaves']
    if type(weeks) is not int or weeks<1 or type(leaves) is not list or not leaves:raise InformationError('information_graph_invalid')
    identifiers=set();probability=Fraction()
    for leaf in leaves:
        if type(leaf) is not dict or set(leaf)!={'id','probability','observations'} or type(leaf['id']) is not str or not leaf['id'].strip() or leaf['id'] in identifiers:raise InformationError('information_leaf_invalid')
        identifiers.add(leaf['id'])
        try:
            if type(leaf['probability']) not in (str,int):raise ValueError()
            p=Fraction(leaf['probability'])
            if not 0<p<=1:raise ValueError()
        except (ValueError,TypeError,ZeroDivisionError) as e:raise InformationError('information_probability_invalid') from e
        probability+=p
        if type(leaf['observations']) is not list or len(leaf['observations'])!=weeks or any(type(value) is not str or not value for value in leaf['observations']):raise InformationError('information_observation_invalid')
    if probability!=1:raise InformationError('information_probability_invalid')
    if type(actions) is not dict or set(actions)!=identifiers:raise InformationError('information_actions_incomplete')
    for path in actions.values():
        if type(path) is not list or len(path)!=weeks:raise InformationError('information_actions_incomplete')
        # Each element is the complete declared action vector at that week.
        if any(type(vector) is not list or not vector or any(type(n) is not int or n<0 for n in vector) for vector in path):raise InformationError('information_action_invalid')
    widths={len(vector) for path in actions.values() for vector in path}
    if len(widths)!=1:raise InformationError('information_action_invalid')
    violations=[];groups=0
    for week in range(weeks):
        representatives={}
        for leaf in leaves:
            history=tuple(leaf['observations'][:week+1]);action=actions[leaf['id']][week]
            if history not in representatives:representatives[history]=(leaf['id'],action);groups+=1
            else:
                other,expected=representatives[history]
                if action!=expected:violations.append({'week':week,'observed_history':list(history),'leaves':[other,leaf['id']],'actions':[expected,action]})
    return {'status':'policy_information_valid' if not violations else 'policy_information_invalid',
        'error':None if not violations else 'nonanticipativity_violation','violations':violations,'information_nodes':groups,
        'scope':'causality of complete declared action vectors only; no business feasibility, cost, full case grade or hours'}
