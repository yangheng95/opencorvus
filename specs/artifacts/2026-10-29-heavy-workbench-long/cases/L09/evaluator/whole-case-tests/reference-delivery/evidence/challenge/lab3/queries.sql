select payload from (select payload,dense_rank() over(partition by tenant,order_id order by revision desc) rank from observations) where rank=1;
