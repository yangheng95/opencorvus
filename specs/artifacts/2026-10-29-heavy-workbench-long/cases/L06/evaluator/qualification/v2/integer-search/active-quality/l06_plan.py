"""One numeric-vector to public-plan projection; contains no solver or business equations."""


def plan_from_vector(data,keys,values):
    if len(keys)!=len(values):raise ValueError('plan_vector_dimension')
    lookup={}
    for key,value in zip(keys,values):
        if type(value) is bool or int(value)!=value or value<0:raise ValueError('plan_vector_integer')
        identity=tuple(key)
        if identity in lookup:raise ValueError('plan_vector_identity')
        lookup[identity]=int(value)
    T,M,J,S,P=data['weeks'],len(data['raw_materials']),len(data['products']),len(data['suppliers']),len(data['plants'])
    decisions={}
    for scenario in data['scenarios']:
        s=scenario['id']
        decisions[s]={'order_lots':[[[lookup[('q',s,t,k,m)] for m in range(M)] for k in range(S)] for t in range(T)],
                      'truck_on':[[lookup[('truck',s,t,k)] for k in range(S)] for t in range(T)],
                      'production':[[[lookup[('produce',s,t,p,j)] for j in range(J)] for p in range(P)] for t in range(T)],
                      'raw_inventory':[[lookup[('raw',s,t,m)] for m in range(M)] for t in range(T)],
                      'finished_inventory':[[lookup[('fg',s,t,j)] for j in range(J)] for t in range(T)]}
    return {'format':'l06-plan/1','decisions':decisions}
