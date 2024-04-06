import frappe
import requests
import json
import unidecode

fields = {
    "operacao" : {
        "entrada" : "0",
        "saida" : "1"
    },
    "natureza_operacao": True,
    "modelo" : {
        "nf-e" : "1",
        "nfc-e" : "2"
    },
    "finalidade" : {
        "nf-e normal" : "1",
        "ajuste/estorno" : "3",
        "devolucao" : "4"
    },
    "ambiente" : {
        "producao" : "1",
        "homologacao" : "2"
    },
    "data_emissao" : True,
    "cpf" : True,
    "nome_completo" : True,
    "cnpj" : True,
    "razao_social" : True,
    "inscricao_estadual" : True,
    "consumidor_final" : {
        "normal" : "0",
        "consumidor final" : "1",
    }
}

@frappe.whitelist()
def emitirNotaFiscal(*args,**kwargs):

    loaded_json = json.loads(kwargs["doc"])
    print(type(kwargs))
    print(type(kwargs["doc"]))

    result = {}

    for field in loaded_json:
        correct = fields.get(field)
        if correct is not None:
            if correct is True:
                continue
            else:
                clean = unidecode.unidecode(loaded_json[field].lower())
                done = correct.get(clean)
                if done is not None:
                    result[field] = done

    # print(result)    

    headers = {
        'cache-control': "no-cache",
        'content-type': "application/json",
        'x-consumer-key': "gyWBdFdg6FhmyXch6sRSTgd7tnqarons",
        'x-consumer-secret': "sNSejLKAC4rpPqQpdAHd2Fk2574G5KydLmo2LHq6eveSCgix",
        'x-access-token': "1505-705EXBp4QhownseAXewNjeWDw76zGZmwFMLgPDlTdFV41Zkn",
        'x-access-token-secret': "kbPqriwl2PIl78ATStbhZpolt961eL8MQ82QmBWxRbC7LiEI"
    }
    
    url = "https://webmaniabr.com/api/1/nfe/emissao/"

    # response = requests.request("POST", url, data=loaded_json, headers=headers)

    # print(response.text)

@frappe.whitelist()
def puxarDadosCNPJ(*args,**kwargs):

    kwargs["doc"]

    loaded_json = json.loads(kwargs["doc"])

    print(loaded_json)

    cnpj = loaded_json.get("tax_id")
    if (cnpj is not None):

        url = "https://publica.cnpj.ws/cnpj/" + cnpj

        response = requests.request("GET", url)

        dados = json.loads(response.text)

        print(dados)

        razao_social = dados.get("razao_social")
        estabelecimento = dados.get("estabelecimento")
        nome_fantasia = estabelecimento.get("nome_fantasia")
        logradouro = estabelecimento.get("logradouro")
        tipo_logradouro = estabelecimento.get("tipo_logradouro")
        numero = estabelecimento.get("numero")
        complemento = estabelecimento.get("complemento")
        bairro = estabelecimento.get("bairro")
        cep = estabelecimento.get("cep")
        pais = estabelecimento.get("pais").get("nome")
        estado = estabelecimento.get("estado").get("nome")
        cidade = estabelecimento.get("cidade").get("nome")
        inscricoes_estaduais = estabelecimento.get("inscricoes_estaduais")
        if len(inscricoes_estaduais) == 1:
            inscricao_estadual = inscricoes_estaduais[0].get("inscricao_estadual")
        
        customer = frappe.get_doc('Customer', loaded_json.get("name")

        customer.nf_razao_social = razao_social
        customer.nf_inscricao_estadual = inscricao_estadual

        customer.save()


