export const masterDataConfig: Record<string, any> = {
    product_categories: {
        label: 'Product Categories',
        i18nKey: 'admin.master.product_categories',
        pk: 'id',
        fields: [
            { key: 'name', label: 'Name', i18nKey: 'admin.master.fields.name', type: 'text', required: true }
        ]
    },

    ingredient_highlights: {
        label: 'Ingredient Highlights',
        i18nKey: 'admin.master.ingredient_highlights',
        pk: 'id',
        fields: [
            {
                key: 'keyword',
                label: 'Keyword (EN)',
                i18nKey: 'admin.master.fields.keyword_en',
                type: 'text',
                required: true
            },
            {
                key: 'keyword_zh',
                label: 'Keyword (ZH)',
                i18nKey: 'admin.master.fields.keyword_zh',
                type: 'text'
            },
            {
                key: 'color',
                label: 'Status',
                i18nKey: 'admin.master.fields.status',
                type: 'select',
                required: true,
                options: [
                    {
                        value: 'primary',
                        label: 'Muslim-friendly',
                        i18nKey: 'review.statusMuslimFriendly'
                    },
                    {
                        value: 'warning',
                        label: 'Syubhah',
                        i18nKey: 'review.statusSyubhah'
                    },
                    {
                        value: 'danger',
                        label: 'Haram',
                        i18nKey: 'review.statusHaram'
                    }
                ]
            }
        ]
    },

    location_types: {
        label: 'Location Types',
        i18nKey: 'admin.master.location_types',
        pk: 'id',
        fields: [
            {
                key: 'name',
                label: 'Name',
                i18nKey: 'admin.master.fields.name',
                type: 'text',
                required: true
            },

            {
                key: 'emoji',
                label: 'Emoji',
                i18nKey: 'admin.master.fields.emoji',
                type: 'text',
                required: false
            },

            {
                key: 'color',
                label: 'Color (Hex)',
                i18nKey: 'admin.master.fields.color',
                type: 'text',
                required: false
            },

            {
                key: 'icon',
                label: 'Ionicon Key',
                type: 'text',
                required: false
            },
            {
                key: 'is_active',
                label: 'Active',
                i18nKey: 'admin.master.fields.is_active',
                type: 'select',
                options: [
                    { value: true, label: 'Active', i18nKey: 'admin.master.fields.active' },
                    { value: false, label: 'Inactive', i18nKey: 'admin.master.fields.inactive' }
                ]
            }

        ]
    },

    stores: {
        label: 'Stores',
        i18nKey: 'admin.master.stores',
        pk: 'id',
        fields: [
            { key: 'name', label: 'Store Name', i18nKey: 'admin.master.fields.store_name', type: 'text', required: true },
            { key: 'website', label: 'Website', i18nKey: 'admin.master.fields.website', type: 'url' },
            { key: 'logo_url', label: 'Logo URL', i18nKey: 'admin.master.fields.logo_url', type: 'url' },
            { key: 'sort_order', label: 'Sort Order', i18nKey: 'admin.master.fields.sort_order', type: 'number' }
        ]
    },

    category_rules: {
        label: 'Category Rules',
        i18nKey: 'admin.master.category_rules',
        pk: 'id',
        fields: [
            { key: 'keyword', label: 'Keyword', i18nKey: 'admin.master.fields.keyword', type: 'text', required: true },

            {
                key: 'category_id',
                label: 'Category',
                i18nKey: 'admin.master.fields.category',
                type: 'select',
                relation: {
                    table: 'product_categories',
                    value: 'id',
                    label: 'name'
                }
            }
        ]
    }
}
