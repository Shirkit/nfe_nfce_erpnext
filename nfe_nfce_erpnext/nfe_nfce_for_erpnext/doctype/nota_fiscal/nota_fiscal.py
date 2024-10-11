# Copyright (c) 2024, shirkit and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document
from frappe.model.naming import getseries


class NotaFiscal(Document):

    def emitirNotaFiscal(self):
        pass

    def autoname(self):
        # TODO does not work as expected, returning only the last 5 digits instead of the prefix
        if (
            False and
            self.modelo is not None
            and self.modelo.startswith("(")
            and self.modelo.find("-") != -1
        ):
            self.name = getseries(
                self.modelo[self.modelo.find("-") + 1 : -2].strip() + "-MMYY-", 5
            )
            #self.name = self.modelo[self.modelo.find("-") + 1 : -2].strip() + "-MMYY-#####"
