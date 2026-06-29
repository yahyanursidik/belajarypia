-- Menambahkan kolom randomized_questions_count ke tabel lessons
ALTER TABLE public.lessons
ADD COLUMN randomized_questions_count integer NULL;

COMMENT ON COLUMN public.lessons.randomized_questions_count IS 'Jumlah soal yang akan diambil secara acak dari bank soal saat ujian dimulai. Jika NULL, maka seluruh soal akan ditampilkan.';
