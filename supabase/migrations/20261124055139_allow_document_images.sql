-- Preserve the existing formats and permissions; allow screenshots and photos.
update storage.buckets
set allowed_mime_types = case
    when allowed_mime_types is null then null
    else array(
        select distinct mime_type
        from unnest(allowed_mime_types || array['image/png', 'image/jpeg', 'image/webp']) as mime_type
        order by mime_type
    )
end
where id = 'sim-documents';
