frappe.provide("erpnext.item");

$.extend(erpnext.item, {
    show_multiple_variants_dialog: function (frm) {
        var me = this;

        let promises = [];
        let attr_val_fields = {};

        function make_fields_from_attribute_values(attr_dict) {
            let fields = [];
            Object.keys(attr_dict).forEach((name, i) => {
                if (i % 3 === 0) {
                    fields.push({ fieldtype: "Section Break" });
                }
                fields.push({ fieldtype: "Column Break", label: name });
                attr_dict[name].forEach((value) => {
                    fields.push({
                        fieldtype: "Check",
                        label: value,
                        fieldname: value,
                        default: 0,
                        onchange: function () {
                            let selected_attributes = get_selected_attributes();
                            let lengths = [];
                            Object.keys(selected_attributes).map((key) => {
                                if (selected_attributes[key].length > 0)
                                    lengths.push(selected_attributes[key].length);
                            });
                            if (lengths.includes(0)) {
                                me.multiple_variant_dialog.get_primary_btn().html(__("Create Variants"));
                                //me.multiple_variant_dialog.disable_primary_action();
                            } else {
                                let no_of_combinations = lengths.reduce((a, b) => a * b, 1);
                                let msg;
                                if (no_of_combinations === 1) {
                                    msg = __("Make {0} Variant", [no_of_combinations]);
                                } else {
                                    msg = __("Make {0} Variants", [no_of_combinations]);
                                }
                                me.multiple_variant_dialog.get_primary_btn().html(msg);
                                me.multiple_variant_dialog.enable_primary_action();
                            }
                        },
                    });
                });
            });
            return fields;
        }

        function make_and_show_dialog(fields) {
            me.multiple_variant_dialog = new frappe.ui.Dialog({
                title: __("Select Attribute Values"),
                fields: [
                    frm.doc.image
                        ? {
                            fieldtype: "Check",
                            label: __("Create a variant with the template image."),
                            fieldname: "use_template_image",
                            default: 0,
                        }
                        : null,
                    {
                        fieldtype: "HTML",
                        fieldname: "help",
                        options: `<label class="control-label">
							${__("Select at least one value from each of the attributes.")}
						</label>`,
                    },
                ]
                    .concat(fields)
                    .filter(Boolean),
            });

            me.multiple_variant_dialog.set_primary_action(__("Create Variants"), () => {
                let selected_attributes = get_selected_attributes(false);
                let use_template_image = me.multiple_variant_dialog.get_value("use_template_image");

                me.multiple_variant_dialog.hide();
                frappe.call({
                    method: "erpnext.controllers.item_variant.enqueue_multiple_variant_creation",
                    args: {
                        item: frm.doc.name,
                        args: selected_attributes,
                        use_template_image: use_template_image,
                    },
                    callback: function (r) {
                        if (r.message === "queued") {
                            frappe.show_alert({
                                message: __("Variant creation has been queued."),
                                indicator: "orange",
                            });
                        } else {
                            frappe.show_alert({
                                message: __("{0} variants created.", [r.message]),
                                indicator: "green",
                            });
                        }
                    },
                });
            });

            $($(me.multiple_variant_dialog.$wrapper.find(".form-column")).find(".frappe-control")).css(
                "margin-bottom",
                "0px"
            );

            me.multiple_variant_dialog.disable_primary_action();
            me.multiple_variant_dialog.clear();
            me.multiple_variant_dialog.show();
        }

        function get_selected_attributes(pushZero = true) {
            let selected_attributes = {};
            me.multiple_variant_dialog.$wrapper.find(".form-column").each((i, col) => {
                if (i === 0) return;
                let attribute_name = $(col).find(".column-label").html().trim();
                selected_attributes[attribute_name] = [];
                let checked_opts = $(col).find(".checkbox input");
                checked_opts.each((i, opt) => {
                    if ($(opt).is(":checked")) {
                        selected_attributes[attribute_name].push($(opt).attr("data-fieldname"));
                    }
                });
                if (!pushZero && selected_attributes[attribute_name].length == 0)
                    delete selected_attributes[attribute_name];
            });

            return selected_attributes;
        }

        frm.doc.attributes.forEach(function (d) {
            let p = new Promise((resolve) => {
                if (!d.numeric_values) {
                    frappe
                        .call({
                            method: "frappe.client.get_list",
                            args: {
                                doctype: "Item Attribute Value",
                                filters: [["parent", "=", d.attribute]],
                                fields: ["attribute_value"],
                                limit_page_length: 0,
                                parent: "Item Attribute",
                                order_by: "idx",
                            },
                        })
                        .then((r) => {
                            if (r.message) {
                                attr_val_fields[d.attribute] = r.message.map(function (d) {
                                    return d.attribute_value;
                                });
                                resolve();
                            }
                        });
                } else {
                    let values = [];
                    for (var i = d.from_range; i <= d.to_range; i = flt(i + d.increment, 6)) {
                        values.push(i);
                    }
                    attr_val_fields[d.attribute] = values;
                    resolve();
                }
            });

            promises.push(p);
        }, this);

        Promise.all(promises).then(() => {
            let fields = make_fields_from_attribute_values(attr_val_fields);
            make_and_show_dialog(fields);
        });
    }
});