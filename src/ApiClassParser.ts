import { Project } from 'ts-simple-ast'

type IElement = {
  content: string
  name: string
  source: string
  sourceName: string
}

/**
 * Parser for class
 */
export class ApiClassParser {
  protected type: string
  protected filePath: string
  protected className: string
  private ast
  private typeMap = {
    apiSuccessClass: 'apiSuccess',
    apiParamClass: 'apiParam'
  }

  constructor(type) {
    this.ast = new Project()
    this.type = type
  }

  /**
   * Entrance for apidoc plugin
   * @param elements
   * @param element
   */
  parseElements(elements, element) {
    elements.pop()
    this.extractElementContent(element.content)
    const classAst = this.getClassAst({ filePath: this.filePath, className: this.className })
    if (!classAst) {
      return
    }
    const newElements = this.transferToNewElement({ filePath: this.filePath, classAst, prefix: '' })

    elements.push(...newElements)
  }

  /**
   * Get apidoc elements from class ast
   * @param param0
   */
  private transferToNewElement({ filePath, classAst, prefix }): IElement[] {
    const properties = classAst.getProperties()
    let elements: IElement[] = []
    for (const property of properties) {
      const name = prefix ? `${prefix}.${property.getName()}` : property.getName()
      const node = property.getJsDocs()[0]
      const comment = node ? node.getComment() : property.getName()
      const description = prefix ? `${prefix} > ${comment}` : comment
      let type = property.getType().getText()
      let transferType = type
      if (!this.isNativeType(type)) {
        transferType = transferType.includes('[]') ? 'Object[]' : 'Object'
      }
      let contentType = this.capitalize(transferType, property)
      const content = property.hasQuestionToken()
        ? `${contentType} [${name}] ${description}`
        : `${contentType} ${name} ${description}`
      const transferParserType = this.typeMap[this.type]
      elements.push({
        content,
        name: transferParserType.toLowerCase(),
        source: `@${transferParserType} ${content}\n`,
        sourceName: transferParserType
      })
      if (!this.isNativeType(type)) {
        const childAst = this.getClassAst({ filePath, className: type.replace('[]', '') })
        if (childAst) {
          const childs = this.transferToNewElement({ filePath, classAst: childAst, prefix: name })
          elements.push(...childs)
        }
      }
    }
    return elements
  }

  /**
   * Extract file path and class name from element definition
   * @param content element definition
   */
  private extractElementContent(content: string) {
    let startPos = content.indexOf('(')
    let endPos = content.indexOf(')', startPos)
    this.filePath = content.substring(startPos + 1, endPos)
    startPos = content.indexOf('{', endPos)
    endPos = content.indexOf('}', startPos)
    this.className = content.substring(startPos + 1, endPos)
  }

  private getClassAst({ filePath, className }) {
    const file = this.ast.addExistingSourceFile(filePath)
    return file.getClass(className)
  }

  private capitalize(text, property) {
    let contentType = '{' + text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    if (property.getStructure().decorators) {
      const min = property.getStructure().decorators.find(decorator => decorator.name == 'MinLength' || decorator.name == 'Min')
      const max = property.getStructure().decorators.find(decorator => decorator.name == 'MaxLength' || decorator.name == 'Max')
      const allow = property.getStructure().decorators.find(decorator => decorator.name == 'IsIn')
      if ((min || max) && allow) {
        contentType += ` {${min.arguments[0] || ''}~${max.arguments[0] || ''}}=${allow.arguments[0]
          .replace('[', '')
          .replace(']', '')} }`
      } else if (min || max) {
        contentType += ` {${min.arguments[0] || ''}~${max.arguments[0] || ''}} }`
      } else if (allow) {
        contentType += `=${allow.arguments[0].replace('[', '').replace(']', '')} }`
      } else {
        contentType += '}'
      }
    } else {
      contentType += '}'
    }
    return contentType
  }

  private isNativeType(propType) {
    return ['boolean', 'string', 'number', 'Date', 'any'].includes(propType)
  }
}
