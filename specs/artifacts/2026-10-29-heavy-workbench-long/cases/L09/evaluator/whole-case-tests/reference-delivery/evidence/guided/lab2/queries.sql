select a.payload from observations a join (select tenant,order_id,max(revision) revision from observations group by tenant,order_id) b using(tenant,order_id,revision);
