const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Tên danh mục sản phẩm (duy nhất)
});

const Category = mongoose.model('Category', categorySchema);