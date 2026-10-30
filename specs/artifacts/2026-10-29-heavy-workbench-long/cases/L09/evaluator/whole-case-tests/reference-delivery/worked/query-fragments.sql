-- 1_original_rows
select * from example order by tenant,revision;

-- 2_highest_revision
select tenant,order_id,max(revision) revision from example group by tenant,order_id;

-- 3_join_to_raw
select a.* from example a join (select tenant,order_id,max(revision) revision from example group by tenant,order_id) b using(tenant,order_id,revision);

-- 4_equivalent_window
select tenant,order_id,revision,status,amount_minor from (select *,dense_rank() over(partition by tenant,order_id order by revision desc) rank from example) where rank=1;

-- 5_wrong_valid_first
select tenant,order_id,sum(amount_minor) from example where status='active' group by tenant,order_id;