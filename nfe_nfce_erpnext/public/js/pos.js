frappe.provide('erpnext.PointOfSale');
frappe.require('point-of-sale.bundle.js', function () {

    function qz_connect() {
        return new Promise(function (resolve, reject) {
            if (qz && qz.websocket && qz.websocket.isActive()) {
                resolve();
            } else {
                frappe.ui.form.qz_connect().then(() => {
                }).then(resolve, reject);
            }
        });
    }

    var default_printer = null;

    async function qz_print(job) {
        var options = {};
        if (job.printerOptions)
            options = job.printerOptions;

        var data = [{
            type: 'pixel',
            format: 'html',
            flavor: 'plain',
            data: job.html
        }];

        // TODO Add support for more printers than just the default one to print NF-e on the network
        var config = await qz_config(options);

        return qz_connect().then(function () {
            for (var i = 0; i < (job.copies ? job.copies : 1); i++) {
                qz.print(config, data).catch(function (e) {
                    console.error(e);
                }).then(function () {
                });
            }
        });
    }

    var cfg = null;
    async function qz_config(options) {
        if (!default_printer)
            default_printer = await qz.printers.getDefault();

        if (cfg == null) {
            cfg = qz.configs.create(default_printer, options);
        }

        return cfg;
    }

    erpnext.PointOfSale.Payment = class MyPosPayment extends erpnext.PointOfSale.Payment {
        constructor({ events, wrapper }) {
            super({ events, wrapper });
        }

        render_payment_section() {
            super.render_payment_mode_dom();
            super.make_invoice_fields_control();
            super.update_totals_section();

            this.$payment_modes.find(".mode-of-payment").get(0).click();
            this.selected_mode.set_value(0);
        }

    };


    erpnext.PointOfSale.Controller = class MyPosController extends erpnext.PointOfSale.Controller {
        constructor(wrapper) {
            super(wrapper);
        }

        async save_and_checkout() {
            if (this.frm.is_dirty()) {
                let save_error = false;
                let rule = false;
                if (!this.frm.doc.ignore_pricing_rule) {
                    this.frm.doc.ignore_pricing_rule = 1;
                    rule = true;
                }
                await this.frm.save(null, null, null, () => (save_error = true));
                if (rule) {
                    this.frm.doc.ignore_pricing_rule = 0;
                    rule = false;
                }
                // only move to payment section if save is successful
                !save_error && this.payment.checkout();
                // show checkout button on error
                save_error &&
                    setTimeout(() => {
                        this.cart.toggle_checkout_btn(true);
                    }, 300); // wait for save to finish
            } else {
                this.payment.checkout();
            }
        }

        init_payments() {
            this.payment = new erpnext.PointOfSale.Payment({
                wrapper: this.$components_wrapper,
                events: {
                    get_frm: () => this.frm || {},

                    get_customer_details: () => this.customer_details || {},

                    toggle_other_sections: (show) => {
                        if (show) {
                            this.item_details.$component.is(":visible")
                                ? this.item_details.$component.css("display", "none")
                                : "";
                            this.item_selector.toggle_component(false);
                        } else {
                            this.item_selector.toggle_component(true);
                        }
                    },

                    submit_invoice: () => {
                        let rule = false;
                        if (!this.frm.doc.ignore_pricing_rule) {
                            this.frm.doc.ignore_pricing_rule = 1;
                            rule = true;
                            for (let i = 0; i < this.frm.doc.items.length; i++) {
                                this.frm.doc.items[i].pricing_rules = "";
                            }
                        }
                        this.frm.savesubmit().then((r) => {
                            this.toggle_components(false);
                            this.order_summary.toggle_component(true);
                            this.order_summary.load_summary_of(this.frm.doc, true);
                            frappe.show_alert({
                                indicator: "green",
                                message: __("POS invoice {0} created succesfully", [r.doc.name]),
                            });
                        }).finally(() => {
                            if (rule) {
                                this.frm.doc.ignore_pricing_rule = 0;
                                rule = false;
                            }
                        });
                    },
                },
            });
        }
    };

    // TODO: Migrate this into another custom APP exclsuive for Orquidario Bahia or POS
    erpnext.PointOfSale.ItemSelector = class MyPosSelector extends erpnext.PointOfSale.ItemSelector {
        constructor({ frm, wrapper, events, pos_profile, settings }) {
            super({ frm, wrapper, events, pos_profile, settings });
        }

        get_item_html(item) {
            const me = this;
            const { item_image, serial_no, batch_no, actual_qty, uom, price_list_rate, description } = item;
            const precision = flt(price_list_rate, 2) % 1 != 0 ? 2 : 0;
            let indicator_color;
            let qty_to_display = actual_qty;

            if (item.is_stock_item) {
                indicator_color = actual_qty > 10 ? "green" : actual_qty <= 0 ? "red" : "orange";

                if (Math.round(qty_to_display) > 999) {
                    qty_to_display = Math.round(qty_to_display) / 1000;
                    qty_to_display = qty_to_display.toFixed(1) + "K";
                }
            } else {
                indicator_color = "";
                qty_to_display = "";
            }

            function get_item_image_html() {
                if (!me.hide_images && item_image) {
                    return `<div class="item-qty-pill">
                                <span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
                            </div>
                            <div class="flex items-center justify-center h-32 border-b-grey text-6xl text-grey-100">
                                <img
                                    onerror="cur_pos.item_selector.handle_broken_image(this)"
                                    class="h-full item-img" src="${item_image}"
                                    alt="${frappe.abbr(item.item_name)}"
                                >
                            </div>`;
                } else {
                    if (me.hide_images) return "";
                    return `<div class="item-qty-pill">
                                <span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
                            </div>
                            <div class="item-display abbr">${abbr(item.item_name, description)}</div>`;
                }
            }

            function abbr(txt, desc) {
                console.log(txt, desc);
                if (!txt) return "";
                if (desc) {
                    const split = strip(desc).split(":");
                    if (split.length > 1) {
                        if (split[0].slice(-4) == "ABBR") {
                            return split[1].trim();
                        }
                    }
                }
                var abbr = "";
                $.each(txt.split("-"), function (i, w) {
                    if (abbr.length == 0) {
                        if (w.startsWith("Phal")) abbr = "Phal";
                        else if (w.startsWith("Dend")) abbr = "Dend";
                        else {
                            abbr = w.substring(0, 3);
                        }
                    } else {
                        if (w == "Tronco")
                            abbr += " Tronco";
                        else {
                            abbr += " " + w.trim()[0];
                            if (isNumber(w.slice(-1))) {
                                if (isNumber(w.slice(-2))) {
                                    abbr += w.slice(-2).trim();
                                } else {
                                    abbr += w.slice(-1);
                                }
                            }
                        }
                    }
                });

                return abbr || "?";
            };

            function strip(html) {
                let doc = new DOMParser().parseFromString(html, 'text/html');
                return doc.body.textContent || "";
            }


            function isNumber(num) {
                switch (typeof num) {
                    case 'number':
                        return num - num === 0;
                    case 'string':
                        if (num.trim() !== '')
                            return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
                        return false;
                    default:
                        return false;
                }
            }

            return `<div class="item-wrapper"
                    data-item-code="${escape(item.item_code)}" data-serial-no="${escape(serial_no)}"
                    data-batch-no="${escape(batch_no)}" data-uom="${escape(uom)}"
                    data-rate="${escape(price_list_rate || 0)}"
                    title="${item.item_name}">
    
                    ${get_item_image_html()}
    
                    <div class="item-detail">
                        <div class="item-name">
                            ${frappe.ellipsis(item.item_name, 38)}
                        </div>
                        <div class="item-rate">${format_currency(price_list_rate, item.currency, precision) || 0} / ${uom == "Unidade" ? "un" : uom}</div>
                    </div>
                </div>`;
        }

        get_items({ start = 0, page_length = 500, search_term = "" }) {
            return super.get_items({ start, page_length, search_term });
        }

    };

    erpnext.PointOfSale.PastOrderSummary = class MyPastOrderSummary extends erpnext.PointOfSale.PastOrderSummary {
        constructor({ wrapper, settings, events }) {
            events.imprimir_nf = (name) => {
                frappe.run_serially([
                    () => this.imprimir_nf(name),
                ]);
            };

            super({ wrapper, settings, events });
        }

        imprimir_nf(name) {
            frappe.call({
                type: "GET",
                method: "nfe_nfce_erpnext.api.imprimirNotaFiscal",

                args: {
                    "server_pos_invoice": name,
                },
                callback: function (r) {
                    //console.log(r)
                    if (r.message) {
                        let parse = JSON.parse(r.message);
                        // console.log(parse)
                        if (parse.html) {
                            parse.html = parse.html.replaceAll("\n", "");
                            qz_connect().then(() => {
                                qz_print({ html: parse.html, copies: 1 });
                            });
                        }
                        //var doc = frappe.model.sync(r.message)
                        //frappe.set_route("Form", r.message.doctype, r.message.name)
                    }
                }
            });

            frappe.ui.form.qz_init().then(() => {

                qz.security.setCertificatePromise(function (resolve, reject) {
                    fetch(document.location.origin + "/assets/nfe_nfce_erpnext/cert.pem", { cache: 'no-store', headers: { 'Content-Type': 'text/plain' } })
                        .then(function (data) { data.ok ? resolve(data.text()) : reject(data.text()); });
                });

                qz.security.setSignatureAlgorithm("SHA512"); // Since 2.1
                qz.security.setSignaturePromise(function (toSign) {
                    return function (resolve, reject) {
                        fetch(document.location.origin + "/api/method/nfe_nfce_erpnext.api.signQz?message=" + toSign, { cache: 'no-store', headers: { 'Content-Type': 'text/plain' } })
                            .then(function (data) { data.ok ? resolve(data.text()) : reject(data.text()); });
                    };
                });

                qz_connect();
            });

        }

        get_condition_btn_map(after_submission) {
            let returned = super.get_condition_btn_map(after_submission);

            if (after_submission)
                returned[0].visible_btns.push('Imprimir NFC-e');
            /*else {
                returned[1].visible_btns.push('Emitir NFC-e')
                returned[2].visible_btns.push('Emitir NFC-e')
            }*/

            return returned;
        }

        bind_events() {
            super.bind_events();
            this.$summary_container.on("click", ".imprimir-btn", () => {
                // console.log("Imprimir NFC-e")
                this.events.imprimir_nf(this.doc.name);
            });
            // console.log(this.events)
        }
    };

});
